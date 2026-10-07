import sys
sys.path.insert(0, '.')
from topic_detector import TopicSession

s = TopicSession()
tests = [
    ('My project is about AI communication analysis.', 'INIT'),
    ('We use Whisper to transcribe speech in real time.', 'on_topic'),
    ('The system measures filler words and speaking rate.', 'on_topic'),
    ('Sentence embeddings help detect topic shifts.', 'on_topic'),
    ('I went shopping with my friends yesterday.', 'off_topic'),
    ('The weather today is really nice outside.', 'off_topic'),
    ('Back to my project - we use SBERT for NLP.', 'on_topic'),
]
print()
passed = 0
for utt, expected in tests:
    r = s.analyze(utt)
    score  = r['similarity_score']
    status = r['topic_status']
    shift  = 'SHIFT' if r['topic_shift'] else '     '
    score_str = f"{score:.3f}" if score is not None else "N/A  "
    ok = 'PASS' if (expected == 'INIT' or status == expected) else 'FAIL'
    if ok == 'PASS': passed += 1
    print(f"  [{ok}] {status:12s} score={score_str} {shift}  {utt[:60]}")
print(f"\n  {passed}/{len(tests)} passed")
