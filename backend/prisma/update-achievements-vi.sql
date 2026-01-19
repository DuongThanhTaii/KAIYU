-- Update English achievements to Vietnamese
-- Run this in your database to translate achievements

-- First Steps -> Bước đầu tiên
UPDATE achievements 
SET title = 'Bước đầu tiên', 
    description = 'Xem video đầu tiên của bạn'
WHERE code = 'first_video' OR title = 'First Steps';

-- HSK 1 Complete -> Hoàn thành HSK 1
UPDATE achievements 
SET title = 'Hoàn thành HSK 1', 
    description = 'Thành thạo tất cả từ vựng HSK 1'
WHERE code ILIKE '%hsk%1%' OR title ILIKE '%HSK 1%';

-- HSK 2 Complete -> Hoàn thành HSK 2
UPDATE achievements 
SET title = 'Hoàn thành HSK 2', 
    description = 'Thành thạo tất cả từ vựng HSK 2'
WHERE code ILIKE '%hsk%2%' OR title ILIKE '%HSK 2%';

-- HSK 3 Complete -> Hoàn thành HSK 3
UPDATE achievements 
SET title = 'Hoàn thành HSK 3', 
    description = 'Thành thạo tất cả từ vựng HSK 3'
WHERE code ILIKE '%hsk%3%' OR title ILIKE '%HSK 3%';

-- HSK 4 Complete -> Hoàn thành HSK 4
UPDATE achievements 
SET title = 'Hoàn thành HSK 4', 
    description = 'Thành thạo tất cả từ vựng HSK 4'
WHERE code ILIKE '%hsk%4%' OR title ILIKE '%HSK 4%';

-- HSK 5 Complete -> Hoàn thành HSK 5
UPDATE achievements 
SET title = 'Hoàn thành HSK 5', 
    description = 'Thành thạo tất cả từ vựng HSK 5'
WHERE code ILIKE '%hsk%5%' OR title ILIKE '%HSK 5%';

-- HSK 6 Complete -> Hoàn thành HSK 6
UPDATE achievements 
SET title = 'Hoàn thành HSK 6', 
    description = 'Thành thạo tất cả từ vựng HSK 6'
WHERE code ILIKE '%hsk%6%' OR title ILIKE '%HSK 6%';

-- Verify the updates
SELECT id, code, title, description FROM achievements ORDER BY code;
