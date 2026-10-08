from app.detector import scan_text_line, scan_patch

test_cases = [
    ('aws_key = "AKIA1234567890ABCDEF"', "AWS key", "Critical"),
    ('openai_api = "sk-proj-abcde1234567890fghij1234567890"', "OpenAI key", "High"),
    ('token = "ghp_123456789012345678901234567890123456"', "GitHub token", "Critical"),
    ('db = "postgres://admin:secretPass123@db.example.com/production"', "Database URL", "High"),
    ('hook = "https://discord.com/api/webhooks/123456789/abcdefgh"', "Discord webhook URL", "Medium"),
    ('user_id = "550e8400-e29b-41d4-a716-446655440000"', None, None), # UUID should be ignored
    ('dummy_key = "YOUR_API_KEY_HERE_1234567890"', None, None) # Placeholder should be ignored
]

for text, expected_type, expected_sev in test_cases:
    findings = scan_text_line(text, 1, "owner/test-repo", "config.py")
    if expected_type is None:
        assert len(findings) == 0, f"Expected 0 findings for '{text}', got {len(findings)}"
        print(f"[PASS] Ignored correctly: {text}")
    else:
        assert len(findings) > 0, f"Expected finding for '{text}', got 0"
        f = findings[0]
        assert f["secret_type"] == expected_type, f"Expected {expected_type}, got {f['secret_type']}"
        assert f["severity"] == expected_sev, f"Expected {expected_sev}, got {f['severity']}"
        print(f"[PASS] Detected {f['secret_type']} ({f['severity']}): {f['masked_value']}")

print("ALL DETECTOR TESTS PASSED!")
