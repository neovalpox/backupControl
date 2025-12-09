"""
Service de connexion aux e-mails (IMAP, Office 365, Gmail)
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import datetime
import email
from email.header import decode_header
import imaplib
from loguru import logger

from app.core.config import settings


class EmailMessage:
    """Représentation d'un e-mail"""
    def __init__(
        self,
        message_id: str,
        subject: str,
        sender: str,
        recipients: List[str],
        body_text: str,
        body_html: Optional[str],
        received_at: datetime,
        raw_data: Optional[Dict[str, Any]] = None
    ):
        self.message_id = message_id
        self.subject = subject
        self.sender = sender
        self.recipients = recipients
        self.body_text = body_text
        self.body_html = body_html
        self.received_at = received_at
        self.raw_data = raw_data or {}


class EmailProvider(ABC):
    """Interface abstraite pour les providers e-mail"""
    
    @abstractmethod
    async def connect(self) -> bool:
        """Établit la connexion"""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Ferme la connexion"""
        pass
    
    @abstractmethod
    async def fetch_emails(self, limit: int = 500, folder: str = "INBOX") -> List[EmailMessage]:
        """Récupère les derniers e-mails"""
        pass
    
    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        """Teste la connexion et retourne les infos"""
        pass


class IMAPEmailProvider(EmailProvider):
    """Provider IMAP standard"""
    
    def __init__(
        self,
        server: str,
        port: int,
        email_address: str,
        password: str,
        use_ssl: bool = True
    ):
        self.server = server
        self.port = port
        self.email_address = email_address
        self.password = password
        self.use_ssl = use_ssl
        self.connection: Optional[imaplib.IMAP4_SSL] = None
    
    async def connect(self) -> bool:
        """Établit la connexion IMAP"""
        try:
            if self.use_ssl:
                self.connection = imaplib.IMAP4_SSL(self.server, self.port)
            else:
                self.connection = imaplib.IMAP4(self.server, self.port)
            
            self.connection.login(self.email_address, self.password)
            logger.info(f"Connecté à {self.server} en tant que {self.email_address}")
            return True
        except Exception as e:
            logger.error(f"Erreur de connexion IMAP: {e}")
            return False
    
    async def disconnect(self) -> None:
        """Ferme la connexion IMAP"""
        if self.connection:
            try:
                self.connection.logout()
            except:
                pass
            self.connection = None
    
    async def fetch_emails(self, limit: int = 500, folder: str = "INBOX") -> List[EmailMessage]:
        """Récupère les derniers e-mails via IMAP"""
        if not self.connection:
            await self.connect()
        
        emails = []
        
        try:
            self.connection.select(folder)
            
            # Recherche de tous les e-mails
            _, message_numbers = self.connection.search(None, "ALL")
            message_list = message_numbers[0].split()
            
            # Prendre les N derniers
            message_list = message_list[-limit:] if len(message_list) > limit else message_list
            message_list.reverse()  # Du plus récent au plus ancien
            
            for num in message_list:
                try:
                    _, msg_data = self.connection.fetch(num, "(RFC822)")
                    email_body = msg_data[0][1]
                    msg = email.message_from_bytes(email_body)
                    
                    # Extraction des données
                    message_id = msg.get("Message-ID", "")
                    subject = self._decode_header(msg.get("Subject", ""))
                    sender = self._decode_header(msg.get("From", ""))
                    recipients = [self._decode_header(r) for r in msg.get_all("To", [])]
                    date_str = msg.get("Date", "")
                    
                    # Parse de la date
                    try:
                        received_at = email.utils.parsedate_to_datetime(date_str)
                    except:
                        received_at = datetime.now()
                    
                    # Extraction du corps
                    body_text, body_html = self._extract_body(msg)
                    
                    emails.append(EmailMessage(
                        message_id=message_id,
                        subject=subject,
                        sender=sender,
                        recipients=recipients,
                        body_text=body_text,
                        body_html=body_html,
                        received_at=received_at
                    ))
                    
                except Exception as e:
                    logger.warning(f"Erreur lors de la lecture de l'e-mail {num}: {e}")
                    continue
            
            logger.info(f"Récupéré {len(emails)} e-mails depuis {folder}")
            
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des e-mails: {e}")
        
        return emails
    
    def _decode_header(self, header: str) -> str:
        """Décode un en-tête e-mail"""
        if not header:
            return ""
        
        decoded_parts = decode_header(header)
        result = ""
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                try:
                    result += part.decode(encoding or "utf-8", errors="replace")
                except:
                    result += part.decode("utf-8", errors="replace")
            else:
                result += part
        return result
    
    def _extract_body(self, msg) -> tuple[str, Optional[str]]:
        """Extrait le corps text et HTML d'un e-mail"""
        body_text = ""
        body_html = None
        
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition", ""))
                
                if "attachment" in content_disposition:
                    continue
                
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        text = payload.decode(charset, errors="replace")
                        
                        if content_type == "text/plain":
                            body_text = text
                        elif content_type == "text/html":
                            body_html = text
                except:
                    continue
        else:
            try:
                payload = msg.get_payload(decode=True)
                if payload:
                    charset = msg.get_content_charset() or "utf-8"
                    body_text = payload.decode(charset, errors="replace")
            except:
                pass
        
        return body_text, body_html
    
    async def test_connection(self) -> Dict[str, Any]:
        """Teste la connexion IMAP"""
        try:
            connected = await self.connect()
            if connected:
                self.connection.select("INBOX")
                _, message_numbers = self.connection.search(None, "ALL")
                total_emails = len(message_numbers[0].split())
                await self.disconnect()
                
                return {
                    "success": True,
                    "server": self.server,
                    "email": self.email_address,
                    "total_emails": total_emails,
                    "message": "Connexion réussie"
                }
            else:
                return {
                    "success": False,
                    "message": "Impossible de se connecter"
                }
        except Exception as e:
            return {
                "success": False,
                "message": str(e)
            }


class Office365EmailProvider(EmailProvider):
    """Provider Office 365 (Microsoft Graph API)"""
    
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        tenant_id: str,
        email_address: str
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.tenant_id = tenant_id
        self.email_address = email_address
        self.access_token: Optional[str] = None
    
    async def connect(self) -> bool:
        """Obtient un token d'accès via MSAL"""
        try:
            import msal
            
            app = msal.ConfidentialClientApplication(
                self.client_id,
                authority=f"https://login.microsoftonline.com/{self.tenant_id}",
                client_credential=self.client_secret
            )
            
            result = app.acquire_token_for_client(
                scopes=["https://graph.microsoft.com/.default"]
            )
            
            if "access_token" in result:
                self.access_token = result["access_token"]
                logger.info(f"Token Office 365 obtenu pour {self.email_address}")
                return True
            else:
                logger.error(f"Erreur d'authentification Office 365: {result.get('error_description')}")
                return False
                
        except Exception as e:
            logger.error(f"Erreur de connexion Office 365: {e}")
            return False
    
    async def disconnect(self) -> None:
        """Révoque le token"""
        self.access_token = None
    
    async def fetch_emails(self, limit: int = 500, folder: str = "inbox") -> List[EmailMessage]:
        """Récupère les e-mails via Microsoft Graph API"""
        if not self.access_token:
            await self.connect()
        
        emails = []
        
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                url = f"https://graph.microsoft.com/v1.0/users/{self.email_address}/mailFolders/{folder}/messages"
                params = {
                    "$top": limit,
                    "$orderby": "receivedDateTime desc",
                    "$select": "id,subject,from,toRecipients,body,receivedDateTime,internetMessageId"
                }
                headers = {
                    "Authorization": f"Bearer {self.access_token}"
                }
                
                response = await client.get(url, params=params, headers=headers)
                response.raise_for_status()
                
                data = response.json()
                
                for msg in data.get("value", []):
                    try:
                        emails.append(EmailMessage(
                            message_id=msg.get("internetMessageId", msg.get("id")),
                            subject=msg.get("subject", ""),
                            sender=msg.get("from", {}).get("emailAddress", {}).get("address", ""),
                            recipients=[r.get("emailAddress", {}).get("address", "") 
                                       for r in msg.get("toRecipients", [])],
                            body_text=msg.get("body", {}).get("content", ""),
                            body_html=msg.get("body", {}).get("content", "") if msg.get("body", {}).get("contentType") == "html" else None,
                            received_at=datetime.fromisoformat(msg.get("receivedDateTime", "").replace("Z", "+00:00"))
                        ))
                    except Exception as e:
                        logger.warning(f"Erreur lors du parsing de l'e-mail Office 365: {e}")
                        continue
                
                logger.info(f"Récupéré {len(emails)} e-mails depuis Office 365")
                
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des e-mails Office 365: {e}")
        
        return emails
    
    async def test_connection(self) -> Dict[str, Any]:
        """Teste la connexion Office 365"""
        try:
            connected = await self.connect()
            if connected:
                return {
                    "success": True,
                    "email": self.email_address,
                    "message": "Connexion Office 365 réussie"
                }
            else:
                return {
                    "success": False,
                    "message": "Impossible d'obtenir un token d'accès"
                }
        except Exception as e:
            return {
                "success": False,
                "message": str(e)
            }


class GmailEmailProvider(EmailProvider):
    """Provider Gmail (Google API)"""
    
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        email_address: str,
        refresh_token: Optional[str] = None
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.email_address = email_address
        self.refresh_token = refresh_token
        self.credentials = None
    
    async def connect(self) -> bool:
        """Établit la connexion Gmail"""
        try:
            from google.oauth2.credentials import Credentials
            from google.auth.transport.requests import Request
            
            if self.refresh_token:
                self.credentials = Credentials(
                    None,
                    refresh_token=self.refresh_token,
                    client_id=self.client_id,
                    client_secret=self.client_secret,
                    token_uri="https://oauth2.googleapis.com/token"
                )
                
                if self.credentials.expired:
                    self.credentials.refresh(Request())
                
                logger.info(f"Connecté à Gmail en tant que {self.email_address}")
                return True
            else:
                logger.error("Refresh token Gmail non configuré")
                return False
                
        except Exception as e:
            logger.error(f"Erreur de connexion Gmail: {e}")
            return False
    
    async def disconnect(self) -> None:
        """Révoque les credentials"""
        self.credentials = None
    
    async def fetch_emails(self, limit: int = 500, folder: str = "INBOX") -> List[EmailMessage]:
        """Récupère les e-mails via Gmail API"""
        if not self.credentials:
            await self.connect()
        
        emails = []
        
        try:
            from googleapiclient.discovery import build
            
            service = build("gmail", "v1", credentials=self.credentials)
            
            # Liste des messages
            results = service.users().messages().list(
                userId="me",
                labelIds=[folder.upper()] if folder != "INBOX" else ["INBOX"],
                maxResults=limit
            ).execute()
            
            messages = results.get("messages", [])
            
            for msg_ref in messages:
                try:
                    msg = service.users().messages().get(
                        userId="me",
                        id=msg_ref["id"],
                        format="full"
                    ).execute()
                    
                    headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
                    
                    # Extraction du corps
                    body_text, body_html = self._extract_gmail_body(msg.get("payload", {}))
                    
                    # Parse de la date
                    try:
                        internal_date = int(msg.get("internalDate", 0)) / 1000
                        received_at = datetime.fromtimestamp(internal_date)
                    except:
                        received_at = datetime.now()
                    
                    emails.append(EmailMessage(
                        message_id=headers.get("Message-ID", msg_ref["id"]),
                        subject=headers.get("Subject", ""),
                        sender=headers.get("From", ""),
                        recipients=[headers.get("To", "")],
                        body_text=body_text,
                        body_html=body_html,
                        received_at=received_at
                    ))
                    
                except Exception as e:
                    logger.warning(f"Erreur lors du parsing de l'e-mail Gmail: {e}")
                    continue
            
            logger.info(f"Récupéré {len(emails)} e-mails depuis Gmail")
            
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des e-mails Gmail: {e}")
        
        return emails
    
    def _extract_gmail_body(self, payload: dict) -> tuple[str, Optional[str]]:
        """Extrait le corps d'un message Gmail"""
        import base64
        
        body_text = ""
        body_html = None
        
        def decode_body(data: str) -> str:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
        
        if "parts" in payload:
            for part in payload["parts"]:
                mime_type = part.get("mimeType", "")
                body_data = part.get("body", {}).get("data", "")
                
                if mime_type == "text/plain" and body_data:
                    body_text = decode_body(body_data)
                elif mime_type == "text/html" and body_data:
                    body_html = decode_body(body_data)
                elif "parts" in part:
                    # Récursion pour les multipart
                    sub_text, sub_html = self._extract_gmail_body(part)
                    if sub_text:
                        body_text = sub_text
                    if sub_html:
                        body_html = sub_html
        else:
            body_data = payload.get("body", {}).get("data", "")
            if body_data:
                body_text = decode_body(body_data)
        
        return body_text, body_html
    
    async def test_connection(self) -> Dict[str, Any]:
        """Teste la connexion Gmail"""
        try:
            connected = await self.connect()
            if connected:
                return {
                    "success": True,
                    "email": self.email_address,
                    "message": "Connexion Gmail réussie"
                }
            else:
                return {
                    "success": False,
                    "message": "Impossible de se connecter à Gmail"
                }
        except Exception as e:
            return {
                "success": False,
                "message": str(e)
            }


def get_email_provider() -> EmailProvider:
    """Factory pour obtenir le provider e-mail configuré"""
    email_type = settings.email_type.lower()
    
    if email_type == "imap":
        return IMAPEmailProvider(
            server=settings.imap_server,
            port=settings.imap_port,
            email_address=settings.email_address,
            password=settings.email_password,
            use_ssl=settings.imap_use_ssl
        )
    elif email_type == "office365":
        return Office365EmailProvider(
            client_id=settings.office365_client_id,
            client_secret=settings.office365_client_secret,
            tenant_id=settings.office365_tenant_id,
            email_address=settings.email_address
        )
    elif email_type == "gmail":
        return GmailEmailProvider(
            client_id=settings.gmail_client_id,
            client_secret=settings.gmail_client_secret,
            email_address=settings.email_address
        )
    else:
        raise ValueError(f"Type d'e-mail non supporté: {email_type}")
