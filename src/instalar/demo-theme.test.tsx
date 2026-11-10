import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '@/hooks/use-theme';

const statusBar = vi.hoisted(() => vi.fn());
vi.mock('@/lib/status-bar', () => ({ aplicarBarraDeStatus: statusBar }));

function Controls() {
  const theme = useTheme();
  return <><p>{theme.mode}/{theme.palette}</p><button onClick={theme.toggleMode}>Toggle</button><button onClick={() => theme.setPalette('rose')}>Rose</button></>;
}
beforeEach(() => { localStorage.clear(); statusBar.mockClear(); });
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.documentElement.removeAttribute('style');
});

describe('installation demo theme isolation', () => {
  it('starts light/default and keeps edits in memory without touching the saved app theme', () => {
    localStorage.setItem('core-theme-mode', 'dark');
    localStorage.setItem('core-theme-palette', 'ocean');
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    render(<ThemeProvider persist={false}><Controls /></ThemeProvider>);
    expect(screen.getByText('light/default')).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass('dark');
    fireEvent.click(screen.getByText('Toggle')); fireEvent.click(screen.getByText('Rose'));
    expect(screen.getByText('dark/rose')).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
    expect(read).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
    expect(statusBar).not.toHaveBeenCalled();
    read.mockRestore();
    expect(localStorage.getItem('core-theme-mode')).toBe('dark');
    expect(localStorage.getItem('core-theme-palette')).toBe('ocean');
  });

  it('does not access blocked storage when rendering or toggling the preview', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('blocked'); });
    expect(() => render(<ThemeProvider persist={false}><Controls /></ThemeProvider>)).not.toThrow();
    fireEvent.click(screen.getByText('Toggle'));
    expect(screen.getByText('dark/default')).toBeInTheDocument();
    expect(statusBar).not.toHaveBeenCalled();
  });

  it('preserves persistent theme and native status-bar behavior by default', async () => {
    localStorage.setItem('core-theme-mode', 'dark');
    localStorage.setItem('core-theme-palette', 'ocean');
    render(<ThemeProvider><Controls /></ThemeProvider>);
    expect(screen.getByText('dark/ocean')).toBeInTheDocument();
    await waitFor(() => expect(statusBar).toHaveBeenCalledWith('dark'));
    fireEvent.click(screen.getByText('Toggle')); fireEvent.click(screen.getByText('Rose'));
    expect(localStorage.getItem('core-theme-mode')).toBe('light');
    expect(localStorage.getItem('core-theme-palette')).toBe('rose');
    await waitFor(() => expect(statusBar).toHaveBeenCalledWith('light'));
  });
});
