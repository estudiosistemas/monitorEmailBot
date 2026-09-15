import type { EmailProvider } from './email-provider.js';
import { gmailProvider } from './gmail/gmail-provider.js';
import { outlookProvider } from './outlook/outlook-provider.js';
import { imapProvider } from './imap/imap-provider.js';

export class ProviderFactory {
  private providers: Map<string, EmailProvider> = new Map();

  register(name: string, provider: EmailProvider): void {
    this.providers.set(name.toLowerCase(), provider);
  }

  get(providerName: string): EmailProvider {
    const provider = this.providers.get(providerName.toLowerCase());
    if (!provider) {
      throw new Error(`Proveedor no soportado: ${providerName}`);
    }
    return provider;
  }

  has(providerName: string): boolean {
    return this.providers.has(providerName.toLowerCase());
  }
}

export const providerFactory = new ProviderFactory();
providerFactory.register('gmail', gmailProvider);
providerFactory.register('outlook', outlookProvider);
providerFactory.register('imap', imapProvider);
