/**
 * Battlecard Command (Cloud-Ready)
 * Generate competitive battlecards with talk scripts following SOW v2.0 patterns
 */

import { CommandArgs, CommandContext, CommandResult } from "../../types.js";
import { withAuth, withQuotaCheck, withPlan } from "../../shared/auth-quota-pipe.js";
import { callApi } from "../../shared/cloud-api-client.js";
import { trackCommand } from "../../../services/telemetry/command-tracker.js";

interface BattlecardData {
  competitor: string;
  strengths: string[];
  weaknesses: string[];
  positioning: string;
  talkTracks: {
    objection: string;
    response: string;
  }[];
  pricing: {
    comparison: string;
    strategy: string;
  };
  winRate: number;
}

export const battlecardCommand = {
  name: "battlecard",
  category: "business" as const,
  description: "Generate competitive battlecards with talk scripts (Pro+)",
  usage: "--competitor <name> [--customer <company>] [--industry <type>] [--size <enterprise|mid-market|smb>]",
  
  execute: withAuth(withQuotaCheck("battlecard")(withPlan("PRO")(async (context, ...args) => {
    const startTime = Date.now();
    const competitor = extractCompetitor(args);
    const customer = extractCustomer(args);
    const industry = extractIndustry(args);
    const size = extractSize(args);
    
    if (!competitor) {
      console.log('💡 Usage: /battlecard --competitor "CompetitorX"');
      console.log('   Options: --customer "ABC Corp" --industry "manufacturing" --size "enterprise"');
      console.log('🧪 Preview Feature (Pro+) • Join waitlist: https://maria-code.ai/waitlist');
      return { success: false, endReason: 'invalid-input' };
    }

    console.log(`⚔️ Generating battlecard for ${competitor}...`);

    try {
      const response = await callApi('/v1/business/battlecard', {
        method: 'POST',
        body: JSON.stringify({
          competitor,
          customer,
          industry,
          size,
          includeScripts: true,
          format: 'detailed'
        })
      });

      if (response.success && response.data) {
        const battlecard = response.data as BattlecardData;
        displayBattlecard(battlecard);
        
        console.log('\n📄 Battlecard generated successfully');
        console.log('💼 Full PDF export available in Pro+');
        
      } else {
        // Fallback to sample battlecard
        const sampleCard = generateSampleBattlecard(competitor);
        displayBattlecard(sampleCard);
        
        console.log('\n🧪 Sample Battlecard • Upgrade to Pro for real competitive intelligence');
        console.log('📋 Upgrade: https://maria-code.ai/pricing');
      }

      await trackCommand({
        cmd: 'battlecard',
        status: 'success',
        latencyMs: Date.now() - startTime,
        plan: context.plan.name,
        quotaLeft: context.quotaLeft,
        userId: context.userId
      });

      return { success: true, endReason: 'completed' };

    } catch (error) {
      console.log('❌ Battlecard generation unavailable');
      console.log('🧪 Preview Feature • Coming soon in Pro+');
      
      // Show sample as fallback
      const sampleCard = generateSampleBattlecard(competitor);
      displayBattlecard(sampleCard);
      console.log('\n🔧 Using sample data - Service temporarily unavailable');
      
      await trackCommand({
        cmd: 'battlecard',
        status: 'error',
        latencyMs: Date.now() - startTime,
        plan: context.plan.name,
        quotaLeft: context.quotaLeft,
        userId: context.userId
      });

      return { success: false, endReason: 'service-error' };
    }
  })))
};

function displayBattlecard(data: BattlecardData): void {
  console.log(`\n⚔️ Competitive Battlecard: ${data.competitor}`);
  console.log('═'.repeat(50));
  
  // Positioning
  console.log('\n🎯 Our Position:');
  console.log(`   ${data.positioning}`);
  
  // Strengths vs Weaknesses
  console.log('\n💪 Our Strengths:');
  data.strengths.forEach(strength => {
    console.log(`   ✅ ${strength}`);
  });
  
  console.log('\n🎯 Their Weaknesses:');
  data.weaknesses.forEach(weakness => {
    console.log(`   ❌ ${weakness}`);
  });
  
  // Talk Tracks
  console.log('\n💬 Talk Tracks:');
  data.talkTracks.forEach((track, i) => {
    console.log(`\n   ${i + 1}. Objection: "${track.objection}"`);
    console.log(`      Response: "${track.response}"`);
  });
  
  // Pricing Strategy
  console.log('\n💰 Pricing Strategy:');
  console.log(`   Comparison: ${data.pricing.comparison}`);
  console.log(`   Strategy: ${data.pricing.strategy}`);
  
  // Win Rate
  console.log('\n📊 Historical Performance:');
  console.log(`   Win Rate vs ${data.competitor}: ${data.winRate}%`);
  
  // Action Items
  console.log('\n🎯 Next Steps:');
  console.log('   1. Qualify customer budget and timeline');
  console.log('   2. Schedule technical demo focused on our strengths');
  console.log('   3. Address pricing concerns with ROI calculator');
  console.log('   4. Get stakeholder buy-in with executive briefing');
}

function generateSampleBattlecard(competitor: string): BattlecardData {
  return {
    competitor,
    strengths: [
      'Superior AI accuracy and performance',
      'Enterprise-grade security and compliance',
      'Faster implementation and time-to-value',
      'Better customer support and response times'
    ],
    weaknesses: [
      'Limited customization options',
      'Higher upfront costs',
      'Smaller partner ecosystem',
      'Less brand recognition in market'
    ],
    positioning: `We provide enterprise-ready AI solutions that deliver measurable ROI faster than ${competitor}, with superior accuracy and security built for Fortune 500 requirements.`,
    talkTracks: [
      {
        objection: `"${competitor} is cheaper and well-known in the market"`,
        response: 'While their initial price may seem lower, our customers achieve ROI 3x faster due to our superior accuracy and faster implementation. The total cost of ownership favors our solution when you factor in the hidden costs of their longer deployment cycles and additional customization needs.'
      },
      {
        objection: `"${competitor} has more integrations"`,
        response: 'Quality over quantity - our integrations are purpose-built for enterprise use cases. We focus on the 20% of integrations that 80% of enterprises actually use, ensuring they work flawlessly rather than offering hundreds of basic connectors.'
      },
      {
        objection: '"We need more customization flexibility"',
        response: 'Our platform is designed for configuration over customization - meaning you get enterprise-grade flexibility without the complexity and maintenance burden of custom code. This approach reduces your TCO by 40% compared to heavily customized solutions.'
      }
    ],
    pricing: {
      comparison: `${competitor} appears 20-30% cheaper initially but has hidden costs in implementation, customization, and ongoing maintenance`,
      strategy: 'Position on Total Cost of Ownership (TCO) and faster time-to-value. Offer ROI calculator and pilot program to demonstrate value.'
    },
    winRate: 68
  };
}

function extractCompetitor(args: string[]): string | undefined {
  const competitorArg = args.find(arg => arg.startsWith('--competitor=') || arg.startsWith('-c='));
  if (competitorArg) {
    return competitorArg.split('=')[1]?.replace(/"/g, '');
  }
  
  // Check for next argument after --competitor or -c flag
  const competitorIndex = args.findIndex(arg => arg === '--competitor' || arg === '-c');
  if (competitorIndex !== -1 && competitorIndex + 1 < args.length) {
    return args[competitorIndex + 1].replace(/"/g, '');
  }
  
  return undefined;
}

function extractCustomer(args: string[]): string | undefined {
  const customerArg = args.find(arg => arg.startsWith('--customer='));
  return customerArg?.split('=')[1]?.replace(/"/g, '');
}

function extractIndustry(args: string[]): string | undefined {
  const industryArg = args.find(arg => arg.startsWith('--industry='));
  return industryArg?.split('=')[1]?.replace(/"/g, '');
}

function extractSize(args: string[]): string | undefined {
  const sizeArg = args.find(arg => arg.startsWith('--size='));
  return sizeArg?.split('=')[1]?.replace(/"/g, '');
}