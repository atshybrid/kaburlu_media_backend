-- Delete PDF URL to force regeneration
UPDATE "ReporterIDCard" 
SET "pdfUrl" = NULL 
WHERE "reporterId" = 'cml1b4zw80006bzyjmv35ytnk';
