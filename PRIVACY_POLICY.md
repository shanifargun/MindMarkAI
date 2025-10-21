# Privacy Policy for MindMarkAI

**Last Updated:** January 2025

## Overview

MindMarkAI is committed to protecting your privacy. This privacy policy explains how our Chrome extension collects, uses, and safeguards your information.

## Data Collection and Usage

### What Data We Collect

MindMarkAI collects minimal, anonymized usage data through Google Analytics 4:

1. **Usage Analytics:**
   - Extension installation and update events
   - Feature usage statistics (e.g., bookmarks saved, screenshots captured)
   - AI summarization events (started, completed, failed)
   - Anonymous interaction events (button clicks, feature engagement)

2. **Technical Data:**
   - Randomly generated anonymous client ID (UUID)
   - Session information
   - Extension version
   - Event timestamps

### What Data We DO NOT Collect

We explicitly **DO NOT** collect:
- Personal information (names, emails, addresses, etc.)
- Bookmark URLs or page addresses
- Page content or text
- AI-generated summaries
- Browsing history
- Search queries
- Any personally identifiable information

## How Your Bookmarks Are Stored

**100% Local Storage:**
- All bookmarks, summaries, and collections are stored locally on your device using Chrome's storage API
- Your bookmark content **NEVER** leaves your browser
- No bookmark data is transmitted to our servers or any third party
- AI summarization happens entirely on your device using Chrome's built-in Gemini Nano model

## Third-Party Services

### Google Analytics 4
We use Google Analytics 4 Measurement Protocol to collect anonymized usage statistics. This helps us understand how users interact with features and improve the extension.

- **Data sent:** Anonymous event data (feature usage, counts)
- **Data NOT sent:** Personal information, bookmark content, URLs, page text
- **Purpose:** Product improvement and feature analytics
- **Google's Privacy Policy:** https://policies.google.com/privacy

### Chrome APIs
MindMarkAI uses Chrome's built-in APIs:
- **Gemini Nano AI:** All AI processing happens locally on your device. No data is sent to Google's cloud services.
- **Chrome Storage API:** Bookmark data is stored locally in your browser's secure storage.

## Permissions Explanation

MindMarkAI requests the following permissions:

- **storage:** To save your bookmarks and settings locally on your device
- **activeTab:** To access page content only when you click the bookmark button
- **tabs:** To capture screenshots and open bookmarks page when requested
- **notifications:** To send optional weekly digest reminders (can be disabled in settings)
- **alarms:** To schedule weekly notifications at your preferred time
- **host_permissions (<all_urls>):** To allow bookmarking from any website you visit

**Important:** These permissions are only used when you explicitly interact with the extension (clicking bookmark/screenshot buttons). We do not monitor your browsing activity.

## Data Security

- All bookmark data is stored locally using Chrome's secure storage APIs
- No remote servers store your bookmark content
- Analytics data is transmitted securely over HTTPS to Google Analytics
- We follow Chrome Web Store security best practices

## Your Control Over Data

**Bookmark Data:**
- You have complete control over your bookmarks
- Delete any bookmark at any time from the bookmarks page
- All data is removed when you uninstall the extension

**Analytics:**
- Analytics data is anonymized and cannot be linked back to you
- You can disable Google Analytics tracking by blocking network requests to google-analytics.com using browser extensions or firewall rules

**Notifications:**
- Weekly digest notifications are optional
- Enable/disable in extension settings
- Customize schedule or turn off completely

## Children's Privacy

MindMarkAI does not knowingly collect information from children under 13. The extension is not directed at children.

## Changes to Privacy Policy

We may update this privacy policy from time to time. Changes will be posted on this page with an updated "Last Updated" date. Continued use of the extension after changes constitutes acceptance of the updated policy.

## Data Retention

- **Bookmark data:** Stored locally until you delete bookmarks or uninstall the extension
- **Analytics data:** Subject to Google Analytics 4 retention policies (default: 14 months)

## Open Source

MindMarkAI is open source. You can review our code to verify our privacy practices:
[GitHub Repository URL - Add your repo link here]

## Contact

If you have questions about this privacy policy or MindMarkAI's privacy practices, please contact:

**Email:** [Your contact email]

## Your Rights

Depending on your location, you may have rights under data protection laws including:
- Right to access your data
- Right to delete your data
- Right to opt-out of analytics

Since all bookmark data is stored locally on your device, you have complete control. Simply delete bookmarks or uninstall the extension to remove all local data.

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR) principles
- California Consumer Privacy Act (CCPA) principles

---

**Summary:** MindMarkAI prioritizes your privacy. Your bookmarks and summaries never leave your device. We only collect anonymized usage statistics to improve the product. You maintain complete control over your data.
