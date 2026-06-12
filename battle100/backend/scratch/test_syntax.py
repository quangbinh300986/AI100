import sys
import os

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(backend_dir)

print("Verifying app.api.reports import and syntax...")
try:
    from app.api.reports import router
    print("SUCCESS: app.api.reports imported successfully without any syntax errors!")
except Exception as e:
    import traceback
    print("FAILED:")
    traceback.print_exc()
    sys.exit(1)
