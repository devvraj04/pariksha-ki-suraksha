import os
import sys

# Ensure python path has the root directory so imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from apps.api.workers.tasks_exam import generate_exam_brochure, generate_admit_cards
from apps.api.workers.tasks_results import compile_exam_results

def main():
    print("\n=== STARTING PDF GENERATION AND COMPILATION ===")
    
    print("Generating information brochures for 3 exams...")
    for exam_id in [
        "f0000000-0000-0000-0000-000000000001",
        "f0000000-0000-0000-0000-000000000002",
        "f0000000-0000-0000-0000-000000000003"
    ]:
        try:
            res = generate_exam_brochure(exam_id)
            print(f"Brochure task result for {exam_id}: {res}")
        except Exception as e:
            print(f"Failed brochure for {exam_id}: {e}")
            
    print("\nGenerating admit cards for registered exams...")
    for exam_id in [
        "f0000000-0000-0000-0000-000000000001",
        "f0000000-0000-0000-0000-000000000003"
    ]:
        try:
            res = generate_admit_cards(exam_id)
            print(f"Admit card task result for {exam_id}: {res}")
        except Exception as e:
            print(f"Failed admit cards for {exam_id}: {e}")
            
    print("\nCompiling results for UGC NET Offline exam...")
    try:
        res = compile_exam_results("f0000000-0000-0000-0000-000000000003")
        print(f"Results compilation task result: {res}")
    except Exception as e:
        print(f"Failed results compilation: {e}")
        
    print("\n=== PDF GENERATION AND COMPILATION COMPLETED ===")

if __name__ == "__main__":
    main()
