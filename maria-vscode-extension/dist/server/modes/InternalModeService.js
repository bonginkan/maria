"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MariaInternalModeService = void 0;
class MariaInternalModeService {
    constructor(connection) {
        this.isActive = false;
        this.connection = connection;
        this.modes = this.initializeModes();
        this.currentMode = this.modes.get('thinking');
    }
    initializeModes() {
        const modes = new Map();
        // Reasoning Modes
        modes.set('thinking', {
            id: 'thinking',
            displayName: 'Thinking',
            description: 'Deep analytical thinking',
            category: 'reasoning',
            icon: '🤔'
        });
        modes.set('analyzing', {
            id: 'analyzing',
            displayName: 'Analyzing',
            description: 'Detailed code analysis',
            category: 'reasoning',
            icon: '🔍'
        });
        // Creative Modes
        modes.set('brainstorming', {
            id: 'brainstorming',
            displayName: 'Brainstorming',
            description: 'Creative idea generation',
            category: 'creative',
            icon: '💡'
        });
        modes.set('designing', {
            id: 'designing',
            displayName: 'Designing',
            description: 'System design and architecture',
            category: 'creative',
            icon: '🎨'
        });
        // Validation Modes
        modes.set('debugging', {
            id: 'debugging',
            displayName: 'Debugging',
            description: 'Bug detection and fixing',
            category: 'validation',
            icon: '🐛'
        });
        modes.set('reviewing', {
            id: 'reviewing',
            displayName: 'Reviewing',
            description: 'Code review and quality check',
            category: 'validation',
            icon: '👀'
        });
        // Optimization Modes
        modes.set('optimizing', {
            id: 'optimizing',
            displayName: 'Optimizing',
            description: 'Performance optimization',
            category: 'optimization',
            icon: '⚡'
        });
        modes.set('refactoring', {
            id: 'refactoring',
            displayName: 'Refactoring',
            description: 'Code refactoring and cleanup',
            category: 'optimization',
            icon: '♻️'
        });
        return modes;
    }
    start() {
        if (this.isActive) {
            return;
        }
        this.isActive = true;
        this.connection.console.log('Internal Mode Service started');
        // Start automatic mode switching based on context
        this.startContextAnalysis();
    }
    stop() {
        this.isActive = false;
        this.connection.console.log('Internal Mode Service stopped');
    }
    switchMode(modeId) {
        const mode = this.modes.get(modeId);
        if (mode) {
            this.currentMode = mode;
            this.notifyModeChange();
        }
    }
    getCurrentMode() {
        return this.currentMode;
    }
    getAllModes() {
        return Array.from(this.modes.values());
    }
    startContextAnalysis() {
        // In production, this would analyze the current context
        // and automatically switch modes based on the task
        // For now, we'll simulate context-based switching
        setInterval(() => {
            if (!this.isActive) {
                return;
            }
            // Simulate context analysis
            const contexts = [
                { pattern: /bug|error|issue/, mode: 'debugging' },
                { pattern: /design|architect/, mode: 'designing' },
                { pattern: /optimize|performance/, mode: 'optimizing' },
                { pattern: /review|check/, mode: 'reviewing' },
                { pattern: /idea|create/, mode: 'brainstorming' },
                { pattern: /analyze|understand/, mode: 'analyzing' },
                { pattern: /refactor|clean/, mode: 'refactoring' }
            ];
            // This would normally analyze the current document/conversation
            // For demonstration, we'll keep the current mode
        }, 5000);
    }
    notifyModeChange() {
        this.connection.sendNotification('maria/modeChanged', {
            mode: this.currentMode
        });
    }
    analyzeContext(text) {
        // Analyze text to determine the best mode
        const lowerText = text.toLowerCase();
        if (lowerText.includes('bug') || lowerText.includes('error')) {
            this.switchMode('debugging');
            return 'debugging';
        }
        if (lowerText.includes('design') || lowerText.includes('architect')) {
            this.switchMode('designing');
            return 'designing';
        }
        if (lowerText.includes('optimize') || lowerText.includes('performance')) {
            this.switchMode('optimizing');
            return 'optimizing';
        }
        if (lowerText.includes('review') || lowerText.includes('quality')) {
            this.switchMode('reviewing');
            return 'reviewing';
        }
        if (lowerText.includes('idea') || lowerText.includes('create')) {
            this.switchMode('brainstorming');
            return 'brainstorming';
        }
        if (lowerText.includes('refactor') || lowerText.includes('clean')) {
            this.switchMode('refactoring');
            return 'refactoring';
        }
        return this.currentMode.id;
    }
}
exports.MariaInternalModeService = MariaInternalModeService;
//# sourceMappingURL=InternalModeService.js.map