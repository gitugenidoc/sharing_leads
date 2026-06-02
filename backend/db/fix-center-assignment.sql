-- Migration script to fix center_id assignments
-- Fixes users with center_id = 0 by assigning them to the correct center

-- Step 1: Ensure QuereCourtage center exists
INSERT INTO centers (name)
VALUES ('QuereCourtage')
ON CONFLICT (name) DO NOTHING;

-- Step 2: Get the correct center_id for QuereCourtage
-- Step 3: Update users with center_id = 0 or NULL (except SUPER_ADMIN)
UPDATE users
SET center_id = (SELECT id FROM centers WHERE name = 'QuereCourtage')
WHERE role IN ('ADMIN', 'AGENT') 
  AND (center_id = 0 OR center_id IS NULL);

-- Verify the fix
SELECT 
  role,
  COUNT(*) as total,
  COALESCE(COUNT(CASE WHEN center_id IS NOT NULL THEN 1 END), 0) as with_center
FROM users
GROUP BY role
ORDER BY role;

-- Show details of fixed users
SELECT 
  email, 
  name, 
  role, 
  center_id,
  (SELECT name FROM centers WHERE id = users.center_id) as center_name
FROM users
WHERE role IN ('ADMIN', 'AGENT')
ORDER BY email;
