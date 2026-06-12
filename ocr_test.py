import sys

try:
    import pytesseract
    from PIL import Image
    print("pytesseract installed")
except ImportError:
    print("pytesseract NOT installed")

try:
    import easyocr
    print("easyocr installed")
except ImportError:
    print("easyocr NOT installed")
