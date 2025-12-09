SELECT c.id, c.name, COUNT(b.id) as backups
FROM clients c 
LEFT JOIN backups b ON b.client_id = c.id 
GROUP BY c.id 
ORDER BY c.name;
