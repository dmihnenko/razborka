// Палитра графиков (recharts) — ЕДИНЫЙ источник.
// Домен визуализации данных требует конкретных цветовых значений (CSS var() в
// SVG-атрибутах recharts резолвится ненадёжно), поэтому это задокументированное
// исключение из правила «только токены». Первый категориальный цвет = бренд
// (--brand-600 #3538CD). Менять палитру графиков — здесь.
export const CHART_BRAND = '#3538CD' // = var(--brand-600)
export const CHART_ACCENT = '#F59E0B' // янтарный — вторая серия

export const CHART_CATEGORICAL = [
  '#3538CD', '#6366F1', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#64748B', '#06B6D4',
]

export const CHART_AXIS = '#94A3B8'
export const CHART_GRID = '#F1F5F9'
export const CHART_TOOLTIP_BORDER = '#E2E8F0'
