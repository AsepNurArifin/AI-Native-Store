__version__ = "0.1.0"

def main() -> None:
    
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
