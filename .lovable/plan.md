

## Fix WelcomeScreen proportions

**Problem**: `mt-auto` on the CTA block pushes title+button+link flush to the bottom of the screen. In the reference, the text flows naturally below the mockup with balanced spacing — not pinned to the bottom edge.

### Changes in `src/components/WelcomeScreen.tsx`

**Line 111 — CTA container**:
- Replace `mt-auto` with `mt-10` (40px gap between mockup and title)
- This gives a natural flow: mockup → gap → title → button → link, with remaining space as bottom padding

That single change aligns the layout with the reference proportions. The mockup size (220x476), title size (text-3xl), button (py-5 rounded-xl), and bottom padding (pb-10) are already correct.

