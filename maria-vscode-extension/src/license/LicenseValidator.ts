import * as vscode from 'vscode';

export class LicenseValidator {
  private licenseKey?: string;
  
  constructor() {
    this.licenseKey = vscode.workspace.getConfiguration('maria').get('licenseKey');
  }
  
  async validateCurrentLicense(): Promise<{ tier: string; features: string[] }> {
    if (!this.licenseKey) {
      return this.getFreeTierInfo();
    }
    
    // Validate enterprise license
    if (this.licenseKey.startsWith('ENT-')) {
      const isValid = await this.validateEnterpriseLicense(this.licenseKey);
      if (isValid) {
        return this.getEnterpriseTierInfo();
      }
    }
    
    return this.getFreeTierInfo();
  }
  
  private async validateEnterpriseLicense(key: string): Promise<boolean> {
    // TODO: Implement actual license validation with server
    // For now, check format
    const pattern = /^ENT-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/;
    return pattern.test(key);
  }
  
  private getFreeTierInfo(): { tier: string; features: string[] } {
    return {
      tier: 'free',
      features: [
        'basic-code-generation',
        'bug-analysis',
        'limited-models',
        'community-support'
      ]
    };
  }
  
  private getEnterpriseTierInfo(): { tier: string; features: string[] } {
    return {
      tier: 'enterprise',
      features: [
        'advanced-code-generation',
        'bug-analysis',
        'security-review',
        'all-models',
        'priority-support',
        'team-collaboration',
        'custom-models',
        'api-access'
      ]
    };
  }
}