---
name: theme-factory
description: 'Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reports, HTML landing pages, React components, etc. There are 10 pre-set themes with colors/fonts that you can apply to any artifact, or can generate a new theme on-the-fly.'
argument-hint: 'What to style + optional preference, e.g. "apply a dark industrial theme to this dashboard" or "show available themes for my landing page"'
---

# Theme Factory Skill

This skill provides a curated collection of professional font and color themes, each with carefully selected color palettes and font pairings. Once a theme is chosen, it can be applied to any artifact.

## Purpose

To apply consistent, professional styling to any artifact (slide deck, component, page, report), use this skill. Each theme includes:
- A cohesive color palette with hex codes
- Complementary font pairings for headers and body text
- A distinct visual identity suitable for different contexts and audiences

## Usage Instructions

To apply styling to an artifact:

1. **Show the available themes**: Display the list of themes below (with color swatches if possible) to allow the user to see what's available.
2. **Ask for their choice**: Ask which theme to apply.
3. **Wait for selection**: Get explicit confirmation about the chosen theme.
4. **Apply the theme**: Once a theme has been chosen, apply the selected theme's colors and fonts to the artifact.

## Themes Available

The following 10 themes are available:

1. **Ocean Depths** — Professional and calming maritime theme
   - Colors: `#0A1628` (background), `#1E3A5F` (primary), `#2E86AB` (accent), `#A8DADC` (light), `#F1FAEE` (text)
   - Fonts: Playfair Display (headers) + Source Sans Pro (body)

2. **Sunset Boulevard** — Warm and vibrant sunset colors
   - Colors: `#2D1B1B` (background), `#8B2635` (primary), `#E07A5F` (accent), `#F2CC8F` (light), `#FEFAE0` (text)
   - Fonts: Raleway (headers) + Lato (body)

3. **Forest Canopy** — Natural and grounded earth tones
   - Colors: `#1A2A1A` (background), `#2D5016` (primary), `#6A994E` (accent), `#A7C957` (light), `#F7F7EE` (text)
   - Fonts: Merriweather (headers) + Open Sans (body)

4. **Modern Minimalist** — Clean and contemporary grayscale
   - Colors: `#FFFFFF` (background), `#F5F5F5` (primary), `#1A1A1A` (dark), `#666666` (mid), `#000000` (text)
   - Fonts: DM Sans (headers) + DM Sans (body)

5. **Golden Hour** — Rich and warm autumnal palette
   - Colors: `#1C1008` (background), `#8B4513` (primary), `#D4821A` (accent), `#F4C661` (light), `#FFF8EE` (text)
   - Fonts: Cormorant Garamond (headers) + Nunito (body)

6. **Arctic Frost** — Cool and crisp winter-inspired theme
   - Colors: `#F0F4F8` (background), `#CBD5E0` (primary), `#2B6CB0` (accent), `#BEE3F8` (light), `#1A202C` (text)
   - Fonts: Josefin Sans (headers) + Roboto (body)

7. **Desert Rose** — Soft and sophisticated dusty tones
   - Colors: `#FAF0EB` (background), `#C9A99A` (primary), `#8B5E52` (accent), `#E8C4B8` (light), `#3D2B26` (text)
   - Fonts: Libre Baskerville (headers) + Quattrocento Sans (body)

8. **Tech Innovation** — Bold and modern tech aesthetic
   - Colors: `#0D0D0D` (background), `#1A1A2E` (primary), `#00D4FF` (accent), `#7B2FBE` (secondary), `#FFFFFF` (text)
   - Fonts: Space Grotesk (headers) + IBM Plex Mono (body)

9. **Botanical Garden** — Fresh and organic garden colors
   - Colors: `#F5F9F0` (background), `#D4E8C2` (primary), `#4A7C59` (accent), `#8FBC8F` (light), `#2C3E2D` (text)
   - Fonts: Crimson Text (headers) + Work Sans (body)

10. **Midnight Galaxy** — Dramatic and cosmic deep tones
    - Colors: `#050A1A` (background), `#0F1F4D` (primary), `#6B46C3` (accent), `#9F7AEA` (light), `#E9D8FD` (text)
    - Fonts: Orbitron (headers) + Exo 2 (body)

## Application Process

After a preferred theme is selected:
1. Apply the specified colors and fonts consistently throughout the artifact
2. Ensure proper contrast and readability (WCAG AA minimum)
3. Maintain the theme's visual identity across all elements
4. For Tailwind CSS projects — use hex values in inline styles or extend `tailwind.config.js`
5. For HTML/CSS — use CSS custom properties (variables)

## Create Your Own Theme

To handle cases where none of the existing themes work for an artifact, create a custom theme. Based on provided inputs:
1. Generate a new theme with a descriptive name
2. Choose appropriate colors/fonts based on the description
3. Show the theme for review and verification
4. Apply the theme as described above

## TSP-V2 Notes

- Project uses **Tailwind CSS** — for custom themes, extend `tailwind.config.js` or use `style` props with hex values
- Existing UI uses muted grays/blues — **Tech Innovation** or **Midnight Galaxy** fit the automotive/industrial tone
- For public-facing pages (`/public/*`) — **Ocean Depths** or **Forest Canopy** feel professional and trustworthy
- For admin/data-heavy pages — **Modern Minimalist** keeps focus on content
