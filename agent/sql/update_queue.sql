-- Mark merged PRs as resolved with 'merged' resolution
UPDATE jules_queue SET state = 'resolved', resolution = 'merged', resolved_at = datetime('now'), updated_at = datetime('now') WHERE pr_number IN (589, 592, 594, 602, 604, 610, 613, 615, 617) AND repo = 'PhD-Writing' AND state IN ('queued', 'active');

-- Mark closed (not merged) PRs as resolved with 'closed' resolution
UPDATE jules_queue SET state = 'resolved', resolution = 'closed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE pr_number IN (587, 588, 590, 591, 593, 595, 597, 599, 600, 601, 603, 605, 606, 607, 608, 609, 611, 612, 614, 616) AND repo = 'PhD-Writing' AND state IN ('queued', 'active');

-- Add new open PRs for PhD-Writing
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (626, 'PhD-Writing', 'queued', 0, 0, datetime('now'), datetime('now'));
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (629, 'PhD-Writing', 'queued', 0, 0, datetime('now'), datetime('now'));
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (631, 'PhD-Writing', 'queued', 0, 0, datetime('now'), datetime('now'));
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (636, 'PhD-Writing', 'queued', 0, 0, datetime('now'), datetime('now'));
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (637, 'PhD-Writing', 'queued', 0, 0, datetime('now'), datetime('now'));
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (638, 'PhD-Writing', 'queued', 0, 0, datetime('now'), datetime('now'));
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (643, 'PhD-Writing', 'queued', 0, 0, datetime('now'), datetime('now'));
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (644, 'PhD-Writing', 'queued', 0, 0, datetime('now'), datetime('now'));
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (650, 'PhD-Writing', 'queued', 0, 0, datetime('now'), datetime('now'));
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (651, 'PhD-Writing', 'queued', 0, 0, datetime('now'), datetime('now'));
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (653, 'PhD-Writing', 'queued', 0, 0, datetime('now'), datetime('now'));
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (659, 'PhD-Writing', 'queued', 0, 0, datetime('now'), datetime('now'));
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (660, 'PhD-Writing', 'queued', 0, 0, datetime('now'), datetime('now'));
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (661, 'PhD-Writing', 'queued', 0, 0, datetime('now'), datetime('now'));

-- Add new open PR for bledsoe-mobile-notary
INSERT INTO jules_queue (pr_number, repo, state, priority, ping_count, created_at, updated_at) VALUES (300, 'bledsoe-mobile-notary', 'queued', 0, 0, datetime('now'), datetime('now'));
