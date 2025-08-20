/**
 * Upgrade Command Module
 * プランアップグレードコマンド - サブスクリプション管理
 * 
 * Phase 4: Low-frequency commands implementation
 * Category: Account Management
 */

import { SlashCommandResult } from '../../services/slash-command-handler';
import { BaseCommand } from './base-command';
import { logger } from '../../utils/logger';

interface PlanDetails {
  name: string;
  emoji: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: string[];
  limits: {
    requests: number | 'unlimited';
    models: string[];
    storage: string;
    support: string;
  };
  benefits: string[];
}

export class UpgradeCommand extends BaseCommand {
  name = 'upgrade';
  category = 'account' as const;
  description = 'Upgrade your MARIA subscription plan';
  usage = '/upgrade [pro|max|enterprise]';
  aliases = ['subscribe', 'plan', 'pricing'];
  
  private plans: Record<string, PlanDetails> = {
    free: {
      name: 'Free',
      emoji: '🆓',
      price: {
        monthly: 0,
        yearly: 0,
      },
      features: [
        'Basic AI models (GPT-4, Claude Sonnet)',
        '100 requests per day',
        'Standard response time',
        'Community support',
        'Basic templates',
      ],
      limits: {
        requests: 100,
        models: ['gpt-4', 'claude-3-sonnet'],
        storage: '100MB',
        support: 'Community forums',
      },
      benefits: [
        'Perfect for trying out MARIA',
        'No credit card required',
        'Access to core features',
      ],
    },
    pro: {
      name: 'Pro',
      emoji: '⭐',
      price: {
        monthly: 29,
        yearly: 290,
      },
      features: [
        'All AI models including GPT-5 & Claude Opus 4.1',
        '10,000 requests per day',
        'Priority response time',
        'Email support',
        'Advanced templates & workflows',
        'Custom aliases & hotkeys',
        'Batch processing',
        'API access',
      ],
      limits: {
        requests: 10000,
        models: ['gpt-5', 'claude-opus-4.1', 'gemini-2.5-pro', 'all-models'],
        storage: '10GB',
        support: 'Email support (24h response)',
      },
      benefits: [
        'Best for professional developers',
        'Save 17% with yearly billing',
        '30-day money-back guarantee',
        'Priority queue access',
      ],
    },
    max: {
      name: 'Max',
      emoji: '🚀',
      price: {
        monthly: 99,
        yearly: 990,
      },
      features: [
        'Unlimited access to all models',
        'Unlimited requests',
        'Instant response time',
        'Priority support',
        'Custom model fine-tuning',
        'Team collaboration (5 seats)',
        'Advanced analytics',
        'White-label options',
        'Early access to new features',
      ],
      limits: {
        requests: 'unlimited',
        models: ['all-models', 'custom-models'],
        storage: '100GB',
        support: 'Priority support (1h response)',
      },
      benefits: [
        'Perfect for teams and agencies',
        'Save 17% with yearly billing',
        'Dedicated account manager',
        'Custom integrations available',
        'SLA guarantee',
      ],
    },
    enterprise: {
      name: 'Enterprise',
      emoji: '🏢',
      price: {
        monthly: -1, // Custom pricing
        yearly: -1,
      },
      features: [
        'Everything in Max',
        'Unlimited team seats',
        'On-premise deployment',
        'Custom SLA',
        'Dedicated infrastructure',
        'SOC 2 compliance',
        'Advanced security features',
        'Custom model training',
        'White-glove onboarding',
      ],
      limits: {
        requests: 'unlimited',
        models: ['all-models', 'custom-models', 'private-models'],
        storage: 'Unlimited',
        support: 'Dedicated support team',
      },
      benefits: [
        'Tailored for large organizations',
        'Volume discounts available',
        'Custom contracts',
        'Compliance certifications',
        'Professional services',
      ],
    },
  };

  async execute(args: string[]): Promise<SlashCommandResult> {
    try {
      if (args.length === 0) {
        return this.showPricingTable();
      }
      
      const requestedPlan = args[0].toLowerCase();
      
      if (requestedPlan === 'compare') {
        return this.comparePlans();
      }
      
      if (requestedPlan === 'current') {
        return this.showCurrentPlan();
      }
      
      const plan = this.plans[requestedPlan];
      
      if (!plan) {
        return this.showPricingTable(requestedPlan);
      }
      
      return this.initiateUpgrade(requestedPlan, plan);
      
    } catch (error) {
      logger.error('Upgrade command error:', error);
      return {
        success: false,
        message: `❌ Upgrade failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private showPricingTable(invalidPlan?: string): SlashCommandResult {
    const errorMessage = invalidPlan
      ? `❌ Invalid plan: "${invalidPlan}"\n\n`
      : '';
    
    return {
      success: !invalidPlan,
      message: `${errorMessage}# 💎 MARIA Subscription Plans

## 🆓 **Free** - $0/month
${this.plans.free.features.map(f => `• ${f}`).join('\n')}

## ⭐ **Pro** - $29/month (Save 17% yearly)
${this.plans.pro.features.slice(0, 5).map(f => `• ${f}`).join('\n')}
*Plus ${this.plans.pro.features.length - 5} more features...*

## 🚀 **Max** - $99/month (Save 17% yearly)
${this.plans.max.features.slice(0, 5).map(f => `• ${f}`).join('\n')}
*Plus ${this.plans.max.features.length - 5} more features...*

## 🏢 **Enterprise** - Custom Pricing
${this.plans.enterprise.features.slice(0, 5).map(f => `• ${f}`).join('\n')}
*Plus ${this.plans.enterprise.features.length - 5} more features...*

---

**Quick Actions:**
• \`/upgrade pro\` - Upgrade to Pro
• \`/upgrade max\` - Upgrade to Max
• \`/upgrade enterprise\` - Contact sales
• \`/upgrade compare\` - Detailed comparison
• \`/upgrade current\` - View your current plan

**Special Offers:**
🎉 **Limited Time**: Use code **MARIA2025** for 20% off first 3 months
📅 **Yearly Discount**: Save 17% on annual plans
💰 **30-Day Guarantee**: Full refund if not satisfied`,
      component: 'auth-flow',
    };
  }

  private comparePlans(): SlashCommandResult {
    const comparisonTable = `# 📊 Detailed Plan Comparison

| Feature | 🆓 Free | ⭐ Pro | 🚀 Max | 🏢 Enterprise |
|---------|---------|--------|--------|--------------|
| **Price/month** | $0 | $29 | $99 | Custom |
| **Requests/day** | 100 | 10,000 | Unlimited | Unlimited |
| **AI Models** | Basic | All | All + Custom | All + Private |
| **Response Time** | Standard | Priority | Instant | Instant |
| **Storage** | 100MB | 10GB | 100GB | Unlimited |
| **Support** | Community | Email (24h) | Priority (1h) | Dedicated |
| **Team Seats** | 1 | 1 | 5 | Unlimited |
| **API Access** | ❌ | ✅ | ✅ | ✅ |
| **Custom Models** | ❌ | ❌ | ✅ | ✅ |
| **On-Premise** | ❌ | ❌ | ❌ | ✅ |
| **SLA** | ❌ | ❌ | ✅ | ✅ |
| **Compliance** | ❌ | ❌ | ❌ | ✅ |

## 🎯 Recommended For:

**Free**: Hobbyists, students, trying out MARIA
**Pro**: Professional developers, freelancers, small projects
**Max**: Teams, agencies, production workloads
**Enterprise**: Large organizations, regulated industries

## 💡 Upgrade Benefits:

**Upgrading to Pro:**
• 100x more requests
• Access to cutting-edge models
• Save hours with advanced features
• ROI in less than a week for most developers

**Upgrading to Max:**
• Never worry about limits
• Perfect for team collaboration
• Custom model training
• White-label your AI tools

**Need Help Choosing?**
• Take our quiz: \`/upgrade quiz\`
• Talk to sales: \`/upgrade contact\`
• Try Pro free: \`/upgrade trial\``;

    return {
      success: true,
      message: comparisonTable,
    };
  }

  private async showCurrentPlan(): Promise<SlashCommandResult> {
    // In production, this would fetch actual user data
    const currentPlan = 'free';
    const usage = {
      requests: 42,
      limit: 100,
      storage: '23MB',
      storageLimit: '100MB',
    };
    
    const plan = this.plans[currentPlan];
    
    return {
      success: true,
      message: `# ${plan.emoji} Your Current Plan: **${plan.name}**

## 📊 Usage This Month
• Requests: **${usage.requests}/${usage.limit}** (${Math.round((usage.requests / usage.limit) * 100)}% used)
• Storage: **${usage.storage}/${usage.storageLimit}**
• Active Models: ${plan.limits.models.length}

## 🎯 Your Benefits
${plan.features.map(f => `• ${f}`).join('\n')}

## 🚀 Upgrade Options

**Why Upgrade to Pro?**
• Get 100x more requests (10,000/day)
• Access GPT-5 and Claude Opus 4.1
• Priority support
• Advanced features

**Limited Time Offer:**
🎉 Use code **UPGRADE20** for 20% off Pro plan

---
• \`/upgrade pro\` - Upgrade now
• \`/upgrade compare\` - Compare all plans
• \`/upgrade trial\` - Try Pro free for 7 days`,
    };
  }

  private initiateUpgrade(planName: string, plan: PlanDetails): SlashCommandResult {
    if (planName === 'enterprise') {
      return {
        success: true,
        message: `# 🏢 Enterprise Plan Inquiry

Thank you for your interest in MARIA Enterprise!

## 📞 Next Steps:
1. **Schedule a Demo**: [calendly.com/maria-sales](https://calendly.com/maria-sales)
2. **Email Sales**: enterprise@bonginkan.ai
3. **Call Us**: +1-888-MARIA-AI

## 📋 Information We'll Need:
• Company size and industry
• Expected usage volume
• Compliance requirements
• Integration needs
• Deployment preferences

## 🎁 What You'll Get:
• Custom pricing based on your needs
• Dedicated onboarding specialist
• Architecture review
• Pilot program options
• ROI analysis

**Typical Response Time**: Within 2 business hours

---
*Meanwhile, you can try Pro features with a free trial:*
\`/upgrade trial\``,
        component: 'auth-flow',
      };
    }
    
    const monthlyPrice = plan.price.monthly;
    const yearlyPrice = plan.price.yearly;
    const yearlySavings = (monthlyPrice * 12) - yearlyPrice;
    
    return {
      success: true,
      message: `# ${plan.emoji} Upgrade to ${plan.name}

## 💳 Billing Options:

**Monthly**: $${monthlyPrice}/month
**Yearly**: $${yearlyPrice}/year (Save $${yearlySavings})

## ✨ What You'll Get:
${plan.features.map(f => `• ${f}`).join('\n')}

## 🎯 Why ${plan.name}?
${plan.benefits.map(b => `• ${b}`).join('\n')}

## 🔐 Secure Checkout:

**Payment Methods Accepted:**
• Credit/Debit Card (Visa, MasterCard, Amex)
• PayPal
• Wire Transfer (Enterprise only)

**To complete your upgrade:**
1. Visit: [maria-code.bonginkan.ai/upgrade/${planName}](https://maria-code.bonginkan.ai/upgrade/${planName})
2. Or run: \`maria upgrade ${planName} --confirm\`

**Guarantee:** 30-day money-back guarantee. Cancel anytime.

---
*Questions? Contact support@bonginkan.ai*`,
      component: 'auth-flow',
    };
  }
}