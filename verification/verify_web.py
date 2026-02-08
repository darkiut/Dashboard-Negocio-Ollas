from playwright.sync_api import sync_playwright

def verify_website():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # 1. Verify Login Page
        page.goto("http://localhost:8000/index.html")
        page.screenshot(path="verification/login_page.png")
        print("Login page screenshot taken.")

        # 2. Verify Dashboard (without login, it might redirect or show empty, but let's check structure)
        # Note: Since auth is client-side firebase, we can't easily fake login without mocking or real credentials.
        # But we can check if the file loads.
        page.goto("http://localhost:8000/dashboard.html")
        # It should redirect to index.html because of checkAuth() in app.js
        # Let's wait a bit for the redirect logic to kick in
        page.wait_for_timeout(2000) 
        
        page.screenshot(path="verification/dashboard_redirect.png")
        print("Dashboard redirect screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_website()
