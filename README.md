# Web App Security Researcher Portfolio

An application security & bug bounty portfolio designed according to the aesthetic, typography, and visual language of **[Mistral AI](https://mistral.ai/)**.

## Highlights & Features

- **Mistral AI Visual System**:
  - Signature stepped pixel flame branding (`#FFAF01` → `#FF8204` → `#FA500F` → `#E51300` → `#C4001D`)
  - Crisp 1px borders with crosshair (`+`) corner tokens
  - Editorial headline typography paired with technical monospace labels and metadata
  - Buttons with Mistral's signature pixel arrow hover transition
  - Full **Dark Mode** & **Light Mode** toggle with instant persistent state

- **Portfolio Sections (As Specified)**:
  - **Hero**:
    - "Web App Security"
    - "I break authentication flows, chain business-logic bugs, and trace attack paths across live production targets — reported through HackerOne and Bugcrowd, on programs spanning fintech, social platforms, and delivery infrastructure."
  - **Where I Report**:
    - Active on **HackerOne** & **Bugcrowd**
  - **Target Programs & Production Scopes**:
    - **Fintech**: PayPal
    - **Health & Fitness**: MyFitnessPal
    - **Travel**: Airbnb
    - **Creative Platform**: Pixiv
    - **Social Commerce**: Meesho
    - **Quick Commerce**: Blinkit / Hyperpure
    - **E-commerce**: Flipkart
    - **Fintech**: bancoplata.mx
  - **Write-ups & CTF Walkthroughs**:
    - Filter tabs: *All*, *Write-ups*, *CTF Walkthroughs*
    - Live instant search filter by bug type, program name, or hashtag
    - Full technical reader modal with syntax-highlighted HTTP request/response proofs of concept, CVSS metrics, severity tags, and remediation
  - **Interactive Write-up Creator & Editor**:
    - Add custom write-ups right in the browser (`+ Create Write-up`)
    - Supports Markdown formatting with live preview
    - Persisted automatically to `localStorage`
    - Export & Import backups as JSON

## How to View and Run

You can open `index.html` directly in any web browser, or serve it using Python or Node:

### Option 1: Direct File Open
Double click `index.html` in file explorer or run:
```powershell
Start-Process "C:\Users\SARMANSINH\.gemini\antigravity\scratch\webapp-security-portfolio\index.html"
```

### Option 2: Local HTTP Server (Python)
```powershell
python -m http.server 3000 --directory "C:\Users\SARMANSINH\.gemini\antigravity\scratch\webapp-security-portfolio"
```
Then navigate to: `http://localhost:3000`

## Recommended Active Workspace
We recommend opening this folder as your active workspace in Antigravity:
`C:\Users\SARMANSINH\.gemini\antigravity\scratch\webapp-security-portfolio`
