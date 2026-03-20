-- Drop old check constraint and add rechazado_ai as valid estado
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_estado_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_estado_check
  CHECK (estado IN ('analizando', 'evaluado', 'aprobado', 'cambios', 'rechazado', 'rechazado_ai', 'error'));
