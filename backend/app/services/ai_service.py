"""
Service d'analyse des e-mails par IA (Claude / OpenAI)
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import re
from loguru import logger

from app.core.config import settings
from app.services.email_service import EmailMessage


# Prompt système pour l'analyse des e-mails de sauvegarde
BACKUP_ANALYSIS_SYSTEM_PROMPT = """Tu es un expert en analyse d'e-mails de notifications de sauvegarde.
Tu dois analyser les e-mails et extraire les informations structurées suivantes.

Types de sauvegardes à identifier:
- Synology Hyper Backup (mots-clés: "Hyper Backup", "Network backup", ".hbk")
- Synology Active Backup for Business (mots-clés: "Active Backup for Business", "AB_")
- RSync (mots-clés: "rsync", "RSYNC")
- Veeam (mots-clés: "Veeam")
- Acronis (mots-clés: "Acronis")
- Windows Server Backup (mots-clés: "Windows Server Backup", "WSB")

Pour chaque e-mail, détermine:
1. S'il s'agit d'une notification de sauvegarde (ou autre type: sécurité, mise à jour, UPS, etc.)
2. Le type de sauvegarde
3. Le statut (succès, échec, avertissement)
4. Le NAS/serveur source (souvent au format NXXX## comme NABO03)
5. Le nom de la tâche de sauvegarde
6. La destination
7. Les dates/heures de début et fin
8. La durée
9. Les tailles (source, transférée, etc.)
10. Les périphériques concernés (pour Active Backup)
11. Tout message d'erreur

Réponds UNIQUEMENT en JSON valide avec la structure suivante:
{
    "is_backup_notification": boolean,
    "notification_type": "backup" | "security" | "update" | "ups" | "other",
    "backup_type": "hyper_backup" | "active_backup" | "rsync" | "veeam" | "acronis" | "windows_backup" | "other" | null,
    "status": "success" | "failure" | "warning" | null,
    "source_nas": string | null,
    "task_name": string | null,
    "destination": string | null,
    "destination_nas": string | null,
    "start_time": "ISO datetime" | null,
    "end_time": "ISO datetime" | null,
    "duration_seconds": number | null,
    "source_size_bytes": number | null,
    "transferred_size_bytes": number | null,
    "devices": [string] | null,
    "error_message": string | null,
    "confidence": number (0-100),
    "raw_extracted": {
        // Données brutes extraites pour référence
    }
}
"""


class AIAnalyzer:
    """Analyseur IA pour les e-mails de sauvegarde"""
    
    def __init__(self, provider: str = None):
        self.provider = provider or settings.ai_provider
    
    async def analyze_email(self, email: EmailMessage) -> Dict[str, Any]:
        """Analyse un e-mail et extrait les informations de sauvegarde"""
        
        # Construction du prompt
        email_content = f"""
Sujet: {email.subject}
De: {email.sender}
Date: {email.received_at.isoformat()}

Contenu:
{email.body_text}
"""
        
        try:
            if self.provider == "claude":
                result = await self._analyze_with_claude(email_content)
            elif self.provider == "openai":
                result = await self._analyze_with_openai(email_content)
            else:
                raise ValueError(f"Provider IA non supporté: {self.provider}")
            
            return result
            
        except Exception as e:
            logger.error(f"Erreur d'analyse IA: {e}")
            return self._fallback_analysis(email)
    
    async def _analyze_with_claude(self, email_content: str) -> Dict[str, Any]:
        """Analyse avec Claude (Anthropic)"""
        import anthropic
        
        client = anthropic.Anthropic(api_key=settings.claude_api_key)
        
        message = client.messages.create(
            model="claude-3-haiku-20240307",  # Modèle rapide et économique
            max_tokens=1024,
            system=BACKUP_ANALYSIS_SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": f"Analyse cet e-mail:\n\n{email_content}"}
            ]
        )
        
        # Extraction du JSON de la réponse
        response_text = message.content[0].text
        return self._parse_json_response(response_text)
    
    async def _analyze_with_openai(self, email_content: str) -> Dict[str, Any]:
        """Analyse avec OpenAI (ChatGPT)"""
        from openai import OpenAI
        
        client = OpenAI(api_key=settings.openai_api_key)
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # Modèle rapide et économique
            messages=[
                {"role": "system", "content": BACKUP_ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": f"Analyse cet e-mail:\n\n{email_content}"}
            ],
            response_format={"type": "json_object"},
            max_tokens=1024
        )
        
        response_text = response.choices[0].message.content
        return self._parse_json_response(response_text)
    
    def _parse_json_response(self, response_text: str) -> Dict[str, Any]:
        """Parse la réponse JSON de l'IA"""
        try:
            # Nettoyage de la réponse
            response_text = response_text.strip()
            
            # Recherche du JSON dans la réponse
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                return json.loads(json_match.group())
            else:
                return json.loads(response_text)
                
        except json.JSONDecodeError as e:
            logger.warning(f"Erreur de parsing JSON: {e}")
            return {
                "is_backup_notification": False,
                "notification_type": "other",
                "error_message": f"Erreur de parsing: {e}",
                "confidence": 0
            }
    
    def _fallback_analysis(self, email: EmailMessage) -> Dict[str, Any]:
        """Analyse de secours sans IA (basée sur des patterns)"""
        subject = email.subject.lower()
        body = email.body_text.lower()
        
        result = {
            "is_backup_notification": False,
            "notification_type": "other",
            "backup_type": None,
            "status": None,
            "source_nas": None,
            "task_name": None,
            "destination": None,
            "confidence": 30
        }
        
        # Détection du type de notification
        if any(kw in subject or kw in body for kw in ["backup", "sauvegarde", "hyper backup", "active backup"]):
            result["is_backup_notification"] = True
            result["notification_type"] = "backup"
        elif "sécurité" in subject or "security" in subject:
            result["notification_type"] = "security"
        elif "mise à jour" in subject or "update" in subject:
            result["notification_type"] = "update"
        elif "onduleur" in subject or "ups" in subject:
            result["notification_type"] = "ups"
        
        # Détection du type de sauvegarde
        if "hyper backup" in body or "network backup" in body:
            result["backup_type"] = "hyper_backup"
        elif "active backup for business" in body:
            result["backup_type"] = "active_backup"
        elif "rsync" in subject.lower() or "rsync" in body:
            result["backup_type"] = "rsync"
        
        # Détection du statut
        if any(kw in subject or kw in body for kw in ["réussi", "succès", "success", "terminée", "effectuée"]):
            result["status"] = "success"
        elif any(kw in subject or kw in body for kw in ["échoué", "échec", "failed", "erreur", "error"]):
            result["status"] = "failure"
        
        # Extraction du NAS source (pattern NXXX##)
        nas_match = re.search(r'\b(N[A-Z]{2,4}\d{1,2})\b', email.subject + " " + email.body_text, re.IGNORECASE)
        if nas_match:
            result["source_nas"] = nas_match.group(1).upper()
        
        return result
    
    async def analyze_batch(self, emails: List[EmailMessage], batch_size: int = 10) -> List[Dict[str, Any]]:
        """Analyse un lot d'e-mails"""
        results = []
        
        for i, email in enumerate(emails):
            logger.info(f"Analyse de l'e-mail {i+1}/{len(emails)}: {email.subject[:50]}...")
            result = await self.analyze_email(email)
            result["email_message_id"] = email.message_id
            results.append(result)
            
            # Pause entre les requêtes pour respecter les rate limits
            if (i + 1) % batch_size == 0:
                import asyncio
                await asyncio.sleep(1)
        
        return results
    
    async def generate_suggestions(self, backup_stats: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Génère des suggestions d'amélioration basées sur les statistiques"""
        
        prompt = f"""Analyse ces statistiques de sauvegardes et génère des suggestions d'amélioration:

{json.dumps(backup_stats, indent=2, ensure_ascii=False)}

Génère une liste de suggestions sous forme de JSON:
[
    {{
        "category": "optimization" | "security" | "reliability" | "config",
        "priority": "low" | "medium" | "high" | "critical",
        "title": "Titre court",
        "description": "Description du problème détecté",
        "recommendation": "Action recommandée"
    }}
]
"""
        
        try:
            if self.provider == "claude":
                import anthropic
                client = anthropic.Anthropic(api_key=settings.claude_api_key)
                
                message = client.messages.create(
                    model="claude-3-haiku-20240307",
                    max_tokens=2048,
                    messages=[{"role": "user", "content": prompt}]
                )
                response_text = message.content[0].text
                
            elif self.provider == "openai":
                from openai import OpenAI
                client = OpenAI(api_key=settings.openai_api_key)
                
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    max_tokens=2048
                )
                response_text = response.choices[0].message.content
            
            # Parse du JSON
            json_match = re.search(r'\[[\s\S]*\]', response_text)
            if json_match:
                return json.loads(json_match.group())
            return []
            
        except Exception as e:
            logger.error(f"Erreur lors de la génération des suggestions: {e}")
            return []


# Instance globale
ai_analyzer = AIAnalyzer()
