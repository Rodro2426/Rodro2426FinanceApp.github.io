# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

The app: React 19 + TypeScript + Vite in `app/`, deployed to GitHub Pages from `main`.
The marketing website: static HTML/CSS/JS served at `/site/` beside the app on the same GitHub Pages deploy (owner's choice, 2026-11-11). The app keeps its root URL so nobody's Home Screen install breaks.

## Users

One person in Colombia (the owner) and their friends and family. They get paid in pesos, often by quincena (1st–15th, 16th–end), use Colombian banks, credit cards, digital wallets, CDTs and cesantías, and mostly live on an iPhone.

The website's first audience is friends and family the owner sends the link to. They need to understand what Pockets is, trust it enough to try it, and install it from Safari. Strangers finding it online are not the target yet.

## Product Purpose

Pockets splits a monthly income into pockets (food, transport, going out, savings) that each start over every week or every quincena, and tells you what's safe to spend today, this week and this month. Success is a person opening it in the morning and knowing their number without doing math.

## Positioning

A budget built around the Colombian pay rhythm (quincenas, COP, TRM, CDTs, cesantías) that runs as a free Home Screen app with no app store, keeps the data on the phone first, and adds shared trips with friends. It is a personal project shared with people the owner knows, not a bank or fintech company.

## Operating Context

- Installed from Safari: Share → Add to Home Screen. Also works as a desktop website.
- Works without an account (data stays on the phone, with backup to a file). An account (email or Google) adds cloud sync and the friends features.
- Real lock-screen notifications for bills, pay day and card due dates.
- English and Spanish; the app opens in the language the person picks.

## Capabilities and Constraints

- Budget: income split into pockets, weekly or quincena periods, carry over, move leftovers, savings goals, safe-to-spend today/week/month.
- Accounts: bank, savings, cash, credit cards, card designs and photos, interest in % E.A., "this isn't mine" switch.
- Scheduled items: income, bills, subscriptions, card payments; can move money automatically or just remind; USD items converted with the TRM.
- Insights: categories, budgets, reports, net worth over time, Excel export with a "For AI" sheet.
- Investments: stocks (Finnhub prices), CDTs, investment funds (FIC, voluntary pension, cesantías), custom asset/debt groups.
- With friends (needs an account): friends by email, shared trips with settle-up, trip chat, direct messages, photos and GIFs.
- Privacy: Face ID lock (a passkey-based privacy lock; it does not encrypt data), hide-amounts eye, backup to file.
- Look: dark mode, custom background color, editable Home layout, practice tour.
- Free. There is no pricing, no paid tier and no app store listing.

## Brand Commitments

- Name: Pockets ("bolsillos" in Spanish copy is fine).
- Logo: the indigo pocket holding a banknote and a lavender card (`app/public/pockets-mark.svg`, `icon-full.svg`).
- Voice: simple, warm, Colombian context first. Plain words, no finance jargon beyond what Colombians use daily (quincena, TRM, CDT, E.A.).
- The Pockets Launch Film (claude.ai artifact 2HewqdCKsNpNwWwJ1DDxVS) and the vertical TikTok ad (`marketing/pockets-tiktok.mp4`) set the marketing look the owner approved: a floating 3D phone in a soft lavender clay world.

## Evidence on Hand

- Real app screenshots captured from the app with sample data (user "Sofía") plus demo investments and a demo trip; amounts are synthetic and must be labeled as sample data.
- The launch film page and the TikTok video.
- No testimonials, user counts, press, ratings or reviews exist. Do not invent any.

## Product Principles

1. One number first: the most important answer (what's safe to spend) is always the first thing you see.
2. Built for the quincena: Colombian pay rhythms and terms are the default, not a localization.
3. Your phone, your data: works without an account; the cloud is an optional copy.
4. Friendly, not a bank: warm and personal, never corporate or salesy.
5. Free and simple to start: no store, no sign-up wall to try it with sample data.

## Accessibility & Inclusion

Spanish and English. Must work on iPhone Safari first. Respect Reduce Motion.
