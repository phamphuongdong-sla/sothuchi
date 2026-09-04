# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Sổ Thu Chi Cá Nhân (PWA)
**Style Standard:** Fintech Precision & Modern Personal Finance (ui-ux-pro-max / frontend-design)
**Category:** Personal Finance / Fintech Management

---

## Global Rules

### Color Palette (Light Theme)

| Role | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| Primary | `#2563EB` | `--color-primary` | Main brand, primary buttons, active links |
| Primary Hover | `#1D4ED8` | `--color-primary-hover` | Button hover state |
| Primary Subtle | `#EFF6FF` | `--color-primary-light` | Active background pills, soft highlights |
| Background | `#F8FAFC` | `--color-bg` | Page background (Slate 50) |
| Surface / Card | `#FFFFFF` | `--color-surface` | Card background, inputs |
| Text Primary | `#0F172A` | `--color-text-primary` | High contrast headings & values (Slate 900) |
| Text Secondary | `#475569` | `--color-text-secondary` | Labels, notes, secondary info (Slate 600) |
| Text Muted | `#94A3B8` | `--color-text-muted` | Placeholders, inactive icons (Slate 400) |
| Border | `#E2E8F0` | `--color-border` | Subtle separators, input borders (Slate 200) |

### Financial Semantic Palette

| Role | Hex | CSS Variable | Soft Background | Usage |
|------|-----|--------------|-----------------|-------|
| Income / Profit | `#10B981` | `--income-color` | `rgba(16, 185, 129, 0.12)` | Thu nhập, thặng dư, tài sản tăng |
| Expense / Loss | `#F43F5E` | `--expense-color` | `rgba(244, 63, 94, 0.12)` | Chi tiêu, nợ, số dư âm |
| Warning / Alerts | `#F59E0B` | `--color-warning` | `rgba(245, 158, 11, 0.12)` | Cảnh báo ngân sách, hạn thanh toán |
| Trust / Neutral | `#2563EB` | `--color-info` | `rgba(37, 99, 235, 0.12)` | Tài sản ròng, ví tiền mặt |

### Color Palette (Dark Theme / OLED Mode)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#3B82F6` | `--color-primary` |
| Primary Hover | `#60A5FA` | `--color-primary-hover` |
| Background | `#090D16` | `--color-bg` (Deep OLED Slate) |
| Surface / Card | `#131D31` | `--color-surface` |
| Text Primary | `#F8FAFC` | `--color-text-primary` |
| Text Secondary | `#94A3B8` | `--color-text-secondary` |
| Border | `#1E293B` | `--color-border` |
| Income | `#34D399` | `--income-color` |
| Expense | `#FB7185` | `--expense-color` |

### Typography

- **Heading & Body Font:** `Inter`, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Financial Numbers:** `font-variant-numeric: tabular-nums` (Căn thẳng hàng các chữ số tiền VND)
- **Mood:** Trustworthy, precise, clean, modern, accessible, Swiss clarity
- **Google Fonts:** [Inter](https://fonts.google.com/share?selection.family=Inter:wght@300;400;500;600;700;800)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Gaps nhỏ, pill badges |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, khoảng cách nội khối |
| `--space-md` | `16px` / `1rem` | Padding chuẩn cho cards, inputs |
| `--space-lg` | `24px` / `1.5rem` | Padding phần lớn, card headers |
| `--space-xl` | `32px` / `2rem` | Khoảng cách giữa các sections |

### Shadow Depths (Fintech Ambient Tokens)

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-xs` | `0 1px 2px 0 rgba(15, 23, 42, 0.04)` | Micro-elements, table rows |
| `--shadow-sm` | `0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)` | Cards thông thường, inputs |
| `--shadow-md` | `0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)` | Hover lift, dropdowns |
| `--shadow-lg` | `0 12px 24px -4px rgba(15, 23, 42, 0.08), 0 4px 8px -2px rgba(15, 23, 42, 0.04)` | Modals, sticky toolbars |
| `--shadow-xl` | `0 20px 32px -6px rgba(15, 23, 42, 0.12), 0 8px 12px -4px rgba(15, 23, 42, 0.06)` | Hero cards, dialog popups |

---

## Component Specs

### Buttons

```css
/* Primary Action Button */
.btn-primary {
  background: var(--color-primary); /* #2563EB */
  color: white;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
  transition: all 150ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--color-primary-hover); /* #1D4ED8 */
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: scale(0.98);
}

/* Secondary Button */
.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  transition: all 150ms ease;
  cursor: pointer;
}

.btn-secondary:hover {
  background: var(--color-bg);
  color: var(--color-text-primary);
  border-color: var(--color-text-muted);
}
```

### Cards & KPI Summary Cards

```css
.card {
  background: var(--color-surface);
  border-radius: 16px;
  border: 1px solid var(--color-border);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  transition: all 150ms ease;
}

.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.summary-card {
  background: var(--color-surface);
  border-radius: 16px;
  border: 1px solid var(--color-border);
  padding: 18px 16px;
  box-shadow: var(--shadow-xs);
  transition: all 150ms ease;
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: rgba(37, 99, 235, 0.25);
}
```

### Inputs

```css
.input, .form-control {
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-size: 16px;
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.input:focus, .form-control:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 3px var(--color-primary-light);
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Soft UI Evolution

**Keywords:** Evolved soft UI, better contrast, modern aesthetics, subtle depth, accessibility-focused, improved shadows, hybrid

**Best For:** Modern enterprise apps, SaaS platforms, health/wellness, modern business tools, professional, hybrid

**Key Effects:** Improved shadows (softer than flat, clearer than neumorphism), modern (200-300ms), focus visible, WCAG AA/AAA

### Page Pattern

**Pattern Name:** Minimal Single Column

- **Conversion Strategy:** Single CTA focus. Large typography. Lots of whitespace. No nav clutter. Mobile-first.
- **CTA Placement:** Center, large CTA button
- **Section Order:** 1. Hero headline, 2. Short description, 3. Benefit bullets (3 max), 4. CTA, 5. Footer

---

## Anti-Patterns (Do NOT Use)

- ❌ Generic templates
- ❌ No portfolio

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
