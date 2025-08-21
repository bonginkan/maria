import * as vscode from 'vscode';
import { MariaConfigurationManager } from '../config/ConfigurationManager';

export interface LicenseStatus {
  isValid: boolean;
  isEnterprise: boolean;
  tier: 'free' | 'enterprise';
  features: string[];
  expiresAt?: Date;
}

export class MariaLicenseManager {
  private configManager: MariaConfigurationManager;
  private licenseServerUrl: string;
  
  constructor(configManager: MariaConfigurationManager) {
    this.configManager = configManager;
    this.licenseServerUrl = configManager.get('enterprise.serverUrl') || 'https://license.bonginkan.ai';
  }
  
  async validateLicense(): Promise<LicenseStatus> {
    const licenseKey = this.configManager.get<string>('enterprise.licenseKey');
    
    if (!licenseKey) {
      return this.getFreeLicense();
    }
    
    try {
      const response = await this.validateEnterpriseLicense(licenseKey);
      return response;
    } catch (error) {
      console.error('License validation failed:', error);
      vscode.window.showWarningMessage(
        'Failed to validate enterprise license. Falling back to free tier.'
      );
      return this.getFreeLicense();
    }
  }
  
  private async validateEnterpriseLicense(key: string): Promise<LicenseStatus> {
    // In production, this would make an actual API call to the license server
    // For now, we'll simulate validation
    
    try {
      // Simulate API call
      const isValid = key.match(/^ENT-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/);
      
      if (isValid) {
        return {
          isValid: true,
          isEnterprise: true,
          tier: 'enterprise',
          features: [
            'advanced-ai',
            'all-cognitive-modes',
            'team-collaboration',
            'priority-support',
            'security-review',
            'approval-system',
            'custom-models',
            'sla-guarantee'
          ],
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        };
      }
    } catch (error) {
      console.error('Error validating license:', error);
    }
    
    return this.getFreeLicense();
  }
  
  private getFreeLicense(): LicenseStatus {
    return {
      isValid: true,
      isEnterprise: false,
      tier: 'free',
      features: [
        'basic-ai',
        'code-generation',
        'bug-analysis',
        'limited-cognitive-modes',
        'community-support'
      ]
    };
  }
  
  async checkFeature(feature: string): Promise<boolean> {
    const status = await this.validateLicense();
    return status.features.includes(feature);
  }
  
  async showUpgradeDialog(): Promise<void> {
    const action = await vscode.window.showInformationMessage(
      'This feature requires MARIA Enterprise. Upgrade to unlock advanced features.',
      'Learn More',
      'Contact Sales',
      'Enter License Key'
    );
    
    switch (action) {
      case 'Learn More':
        vscode.env.openExternal(vscode.Uri.parse('https://maria.bonginkan.ai/enterprise'));
        break;
      case 'Contact Sales':
        vscode.env.openExternal(vscode.Uri.parse('mailto:enterprise@bonginkan.ai'));
        break;
      case 'Enter License Key':
        const key = await vscode.window.showInputBox({
          prompt: 'Enter your MARIA Enterprise license key',
          placeHolder: 'ENT-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX',
          password: true
        });
        
        if (key) {
          await this.configManager.update('enterprise.licenseKey', key);
          const status = await this.validateLicense();
          
          if (status.isEnterprise) {
            vscode.window.showInformationMessage('Enterprise license activated successfully!');
            vscode.commands.executeCommand('workbench.action.reloadWindow');
          } else {
            vscode.window.showErrorMessage('Invalid license key. Please check and try again.');
          }
        }
        break;
    }
  }
}