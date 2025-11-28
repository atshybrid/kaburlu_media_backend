-- Ensure old enum value NATIONAL is not present before removing it
UPDATE "Reporter" SET level = 'STATE' WHERE level = 'NATIONAL';
