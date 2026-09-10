-- PR #637 was merged
UPDATE jules_queue SET state = 'resolved', resolution = 'merged', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 101;

-- All others were closed without merge
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 97;
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 98;
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 99;
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 100;
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 102;
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 103;
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 104;
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 105;
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 106;
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 107;
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 108;
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 109;
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 110;
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = 111;
