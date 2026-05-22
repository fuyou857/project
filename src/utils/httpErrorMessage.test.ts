import { describe, expect, it } from 'vitest';
import {
  compactHtmlGatewayErrorMessage,
  formatHttpNonJsonError,
  underlyingNetworkMessage,
} from './httpErrorMessage';

describe('compactHtmlGatewayErrorMessage', () => {
  it('compresses nginx html errors', () => {
    const html = '<html><title>502 Bad Gateway</title><body>nginx</body></html>';
    expect(compactHtmlGatewayErrorMessage(html)).toContain('HTML');
  });

  it('truncates long plain text', () => {
    const long = 'x'.repeat(3000);
    expect(compactHtmlGatewayErrorMessage(long).length).toBeLessThan(2100);
  });
});

describe('underlyingNetworkMessage', () => {
  it('unwraps fetch context url chain', () => {
    const ctx = { url: 'https://example.com', cause: new Error('inner') };
    expect(underlyingNetworkMessage(ctx)).toContain('example.com');
  });
});

describe('formatHttpNonJsonError', () => {
  it('includes status and snippet', () => {
    const msg = formatHttpNonJsonError(502, 'text/html', '<html>bad</html>', 'OCR');
    expect(msg).toContain('502');
    expect(msg).toContain('OCR');
  });
});
