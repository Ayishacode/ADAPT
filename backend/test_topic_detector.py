"""
test_topic_detector.py
----------------------
Manually written test conversations for Stage-1 Topic-Shift Detection.

Test scenarios covered
----------------------
1. Clearly on-topic utterances
2. Clearly off-topic utterances
3. Borderline / ambiguous utterances
4. Very short responses (should be skipped)
5. Several consecutive on-topic utterances
6. Genuine topic transition followed by on-topic continuation of new topic
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from topic_detector import TopicSession

# ── ANSI colours for terminal output ─────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
GREY   = "\033[90m"
RESET  = "\033[0m"
BOLD   = "\033[1m"


def fmt_status(r: dict) -> str:
    s     = r["topic_status"]
    score = r["similarity_score"]
    shift = r["topic_shift"]
    score_str = f"{score:.4f}" if score is not None else "  N/A "
    if s == "on_topic":
        colour = GREEN
    elif s == "off_topic":
        colour = RED
    elif s == "skipped":
        colour = GREY
    else:
        colour = YELLOW      # initializing
    return (
        f"{colour}{s.upper():15s}{RESET} "
        f"score={BOLD}{score_str}{RESET}  "
        f"shift={RED + 'YES' + RESET if shift else 'no '}"
    )


def run_scenario(title: str, utterances: list[str], expected_shifts: list[bool]):
    print(f"\n{'='*70}")
    print(f"{BOLD}{title}{RESET}")
    print('='*70)
    session = TopicSession()
    passed  = 0
    total   = 0
    for utt, exp_shift in zip(utterances, expected_shifts):
        r = session.analyze(utt)
        ok = (r["topic_shift"] == exp_shift)
        # short/init utterances: mark expectation as N/A
        if r["topic_status"] in ("skipped", "initializing"):
            ok = True   # no assertion for these special states
        tick = f"{GREEN}PASS{RESET}" if ok else f"{RED}FAIL{RESET}"
        print(f"  {tick}  {fmt_status(r)}")
        print(f"       utterance : {GREY}{utt!r}{RESET}")
        print(f"       message   : {r['message']}")
        passed += int(ok)
        total  += 1
    print(f"\n  Result: {passed}/{total} assertions passed")
    return passed, total


def main():
    all_passed = 0
    all_total  = 0

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 1 — Clearly ON-TOPIC: AI communication project
    # ──────────────────────────────────────────────────────────────────────────
    p, t = run_scenario(
        "Scenario 1 — Clearly ON-TOPIC: AI communication system",
        utterances=[
            # Initialiser
            "My final-year project is about an AI system that helps users improve their communication.",
            # On topic
            "We use Whisper to convert speech into text.",
            "The system also analyzes speaking rate and pauses.",
            "We measure filler words and topic relevance in real time.",
            "The NLP pipeline uses sentence transformers for semantic analysis.",
        ],
        expected_shifts=[False, False, False, False, False],
    )
    all_passed += p; all_total += t

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 2 — Clearly OFF-TOPIC after on-topic start
    # ──────────────────────────────────────────────────────────────────────────
    p, t = run_scenario(
        "Scenario 2 — Clearly OFF-TOPIC utterances after on-topic start",
        utterances=[
            "My project is about improving communication using AI and NLP.",
            "We analyze speech patterns to give users real-time feedback.",
            # Off-topic
            "I went shopping with my friends yesterday.",
            "We bought some really nice clothes from the market.",
        ],
        expected_shifts=[False, False, False, True],
    )
    all_passed += p; all_total += t

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 3 — Very short responses (should all be skipped)
    # ──────────────────────────────────────────────────────────────────────────
    p, t = run_scenario(
        "Scenario 3 — Very short responses (expected: skipped, no shift)",
        utterances=["yes", "okay", "right", "sure", "mm-hmm"],
        expected_shifts=[False, False, False, False, False],
    )
    all_passed += p; all_total += t

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 4 — Borderline / ambiguous utterances
    # ──────────────────────────────────────────────────────────────────────────
    p, t = run_scenario(
        "Scenario 4 — Borderline utterances (no hard assertion on shift)",
        utterances=[
            "I use Python for most of my programming projects.",         # borderline
            "The model runs on a standard laptop without a GPU.",        # borderline
            "The accuracy results were quite encouraging in our tests.", # borderline
        ],
        expected_shifts=[False, False, False],
    )
    all_passed += p; all_total += t

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 5 — Single off-topic sentence should NOT trigger confirmed shift
    # ──────────────────────────────────────────────────────────────────────────
    p, t = run_scenario(
        "Scenario 5 — Single off-topic sentence (no confirmed shift yet)",
        utterances=[
            "This project uses machine learning to improve communication.",
            "We train models on speech and text data.",
            "The weather today is really nice outside.",   # one off-topic
            "We evaluate the system using precision and recall metrics.", # back on topic
        ],
        expected_shifts=[False, False, False, False],
    )
    all_passed += p; all_total += t

    # ──────────────────────────────────────────────────────────────────────────
    # Scenario 6 — Genuine topic shift then continuation on new topic
    # ──────────────────────────────────────────────────────────────────────────
    p, t = run_scenario(
        "Scenario 6 — Genuine topic shift then continuation on new topic",
        utterances=[
            # Original topic: AI communication
            "Our system detects filler words and measures speaking rate.",
            "Whisper provides the speech-to-text transcription.",
            # Topic shifts to: cooking
            "I tried a new pasta recipe last night.",
            "The sauce had garlic, tomatoes, and fresh basil.",
            # Should now be on-topic (cooking) after context reset
            "I also made a salad with olive oil and lemon dressing.",
        ],
        expected_shifts=[False, False, False, True, False],
    )
    all_passed += p; all_total += t

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'='*70}")
    colour = GREEN if all_passed == all_total else YELLOW
    print(f"{BOLD}TOTAL: {colour}{all_passed}/{all_total}{RESET}{BOLD} assertions passed{RESET}")
    print('='*70)
    return 0 if all_passed == all_total else 1


if __name__ == "__main__":
    sys.exit(main())
