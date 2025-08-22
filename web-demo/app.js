/**
 * Quicksort Interactive Web Visualization
 * Real-time animation of sorting algorithms
 */

class SortingVisualizer {
    constructor() {
        this.canvas = document.getElementById('sortCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.array = [];
        this.arraySize = 30;
        this.speed = 50;
        this.sorting = false;
        this.paused = false;
        this.soundEnabled = false;
        
        // Statistics
        this.stats = {
            comparisons: 0,
            swaps: 0,
            arrayAccesses: 0,
            startTime: 0,
            endTime: 0
        };
        
        // Colors
        this.colors = {
            default: '#3498db',
            comparing: '#e74c3c',
            swapping: '#f39c12',
            pivot: '#9b59b6',
            sorted: '#2ecc71',
            background: '#ecf0f1'
        };
        
        // Animation state
        this.animations = [];
        this.currentAnimation = 0;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.resizeCanvas();
        this.generateArray();
        this.draw();
    }
    
    setupEventListeners() {
        // Control buttons
        document.getElementById('generateBtn').addEventListener('click', () => this.generateArray());
        document.getElementById('sortBtn').addEventListener('click', () => this.startSort());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('compareBtn').addEventListener('click', () => this.compareAlgorithms());
        
        // Sliders
        document.getElementById('arraySize').addEventListener('input', (e) => {
            this.arraySize = parseInt(e.target.value);
            document.getElementById('arraySizeValue').textContent = this.arraySize;
            if (!this.sorting) {
                this.generateArray();
            }
        });
        
        document.getElementById('speed').addEventListener('input', (e) => {
            this.speed = parseInt(e.target.value);
            document.getElementById('speedValue').textContent = this.speed + 'ms';
        });
        
        // Sound toggle
        document.getElementById('soundEnabled').addEventListener('change', (e) => {
            this.soundEnabled = e.target.checked;
        });
        
        // Window resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        this.canvas.width = Math.min(1200, rect.width - 60);
        this.canvas.height = 400;
    }
    
    generateArray() {
        const pattern = document.getElementById('dataPattern').value;
        this.array = [];
        
        switch (pattern) {
            case 'random':
                for (let i = 0; i < this.arraySize; i++) {
                    this.array.push(Math.floor(Math.random() * 380) + 20);
                }
                break;
            
            case 'sorted':
                for (let i = 0; i < this.arraySize; i++) {
                    this.array.push((i + 1) * (380 / this.arraySize) + 20);
                }
                break;
            
            case 'reverse':
                for (let i = 0; i < this.arraySize; i++) {
                    this.array.push((this.arraySize - i) * (380 / this.arraySize) + 20);
                }
                break;
            
            case 'nearly':
                for (let i = 0; i < this.arraySize; i++) {
                    this.array.push((i + 1) * (380 / this.arraySize) + 20);
                }
                // Shuffle 10% of elements
                for (let i = 0; i < this.arraySize * 0.1; i++) {
                    const idx1 = Math.floor(Math.random() * this.arraySize);
                    const idx2 = Math.floor(Math.random() * this.arraySize);
                    [this.array[idx1], this.array[idx2]] = [this.array[idx2], this.array[idx1]];
                }
                break;
            
            case 'duplicates':
                const values = Array.from({length: 5}, () => Math.floor(Math.random() * 380) + 20);
                for (let i = 0; i < this.arraySize; i++) {
                    this.array.push(values[Math.floor(Math.random() * values.length)]);
                }
                break;
        }
        
        this.animations = [];
        this.currentAnimation = 0;
        this.resetStats();
        this.draw();
    }
    
    draw(highlightIndices = [], highlightType = 'default') {
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const barWidth = (this.canvas.width - 40) / this.arraySize;
        const spacing = 2;
        
        for (let i = 0; i < this.array.length; i++) {
            const x = 20 + i * barWidth;
            const height = this.array[i];
            const y = this.canvas.height - height - 20;
            
            // Determine color
            let color = this.colors.default;
            if (highlightIndices.includes(i)) {
                color = this.colors[highlightType] || this.colors.default;
            }
            
            // Draw bar
            this.ctx.fillStyle = color;
            this.ctx.fillRect(x + spacing/2, y, barWidth - spacing, height);
            
            // Draw value label for small arrays
            if (this.arraySize <= 20) {
                this.ctx.fillStyle = '#2c3e50';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(Math.floor(this.array[i]), x + barWidth/2, y - 5);
            }
        }
    }
    
    async startSort() {
        if (this.sorting) return;
        
        const algorithm = document.getElementById('algorithm').value;
        this.sorting = true;
        this.paused = false;
        this.animations = [];
        this.currentAnimation = 0;
        this.resetStats();
        this.stats.startTime = Date.now();
        
        // Disable controls
        this.setControlsEnabled(false);
        document.getElementById('pauseBtn').disabled = false;
        
        // Generate animations based on algorithm
        const arrayCopy = [...this.array];
        switch (algorithm) {
            case 'quicksort':
                await this.quickSortAnimations(arrayCopy, 0, arrayCopy.length - 1);
                break;
            case 'mergesort':
                await this.mergeSortAnimations(arrayCopy, 0, arrayCopy.length - 1);
                break;
            case 'heapsort':
                await this.heapSortAnimations(arrayCopy);
                break;
            case 'bubblesort':
                await this.bubbleSortAnimations(arrayCopy);
                break;
        }
        
        // Play animations
        await this.playAnimations();
        
        this.stats.endTime = Date.now();
        this.updateStats();
        this.sorting = false;
        this.setControlsEnabled(true);
    }
    
    async quickSortAnimations(arr, left, right) {
        if (left >= right) return;
        
        const pivotIndex = await this.partitionAnimations(arr, left, right);
        await this.quickSortAnimations(arr, left, pivotIndex - 1);
        await this.quickSortAnimations(arr, pivotIndex + 1, right);
    }
    
    async partitionAnimations(arr, left, right) {
        const pivot = arr[right];
        this.animations.push({
            type: 'highlight',
            indices: [right],
            color: 'pivot'
        });
        
        let i = left - 1;
        
        for (let j = left; j < right; j++) {
            this.animations.push({
                type: 'compare',
                indices: [j, right],
                color: 'comparing'
            });
            
            this.stats.comparisons++;
            this.stats.arrayAccesses += 2;
            
            if (arr[j] <= pivot) {
                i++;
                if (i !== j) {
                    this.animations.push({
                        type: 'swap',
                        indices: [i, j],
                        color: 'swapping'
                    });
                    
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                    this.stats.swaps++;
                }
            }
        }
        
        if (i + 1 !== right) {
            this.animations.push({
                type: 'swap',
                indices: [i + 1, right],
                color: 'swapping'
            });
            
            [arr[i + 1], arr[right]] = [arr[right], arr[i + 1]];
            this.stats.swaps++;
        }
        
        this.animations.push({
            type: 'sorted',
            indices: [i + 1],
            color: 'sorted'
        });
        
        return i + 1;
    }
    
    async mergeSortAnimations(arr, left, right) {
        if (left >= right) return;
        
        const mid = Math.floor((left + right) / 2);
        await this.mergeSortAnimations(arr, left, mid);
        await this.mergeSortAnimations(arr, mid + 1, right);
        await this.mergeAnimations(arr, left, mid, right);
    }
    
    async mergeAnimations(arr, left, mid, right) {
        const leftArr = arr.slice(left, mid + 1);
        const rightArr = arr.slice(mid + 1, right + 1);
        
        let i = 0, j = 0, k = left;
        
        while (i < leftArr.length && j < rightArr.length) {
            this.animations.push({
                type: 'compare',
                indices: [left + i, mid + 1 + j],
                color: 'comparing'
            });
            
            this.stats.comparisons++;
            this.stats.arrayAccesses += 2;
            
            if (leftArr[i] <= rightArr[j]) {
                arr[k] = leftArr[i];
                i++;
            } else {
                arr[k] = rightArr[j];
                j++;
            }
            
            this.animations.push({
                type: 'update',
                index: k,
                value: arr[k],
                color: 'swapping'
            });
            
            k++;
        }
        
        while (i < leftArr.length) {
            arr[k] = leftArr[i];
            this.animations.push({
                type: 'update',
                index: k,
                value: arr[k],
                color: 'swapping'
            });
            i++;
            k++;
        }
        
        while (j < rightArr.length) {
            arr[k] = rightArr[j];
            this.animations.push({
                type: 'update',
                index: k,
                value: arr[k],
                color: 'swapping'
            });
            j++;
            k++;
        }
        
        for (let i = left; i <= right; i++) {
            this.animations.push({
                type: 'sorted',
                indices: [i],
                color: 'sorted'
            });
        }
    }
    
    async heapSortAnimations(arr) {
        const n = arr.length;
        
        // Build heap
        for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
            await this.heapifyAnimations(arr, n, i);
        }
        
        // Extract elements
        for (let i = n - 1; i > 0; i--) {
            this.animations.push({
                type: 'swap',
                indices: [0, i],
                color: 'swapping'
            });
            
            [arr[0], arr[i]] = [arr[i], arr[0]];
            this.stats.swaps++;
            
            this.animations.push({
                type: 'sorted',
                indices: [i],
                color: 'sorted'
            });
            
            await this.heapifyAnimations(arr, i, 0);
        }
        
        this.animations.push({
            type: 'sorted',
            indices: [0],
            color: 'sorted'
        });
    }
    
    async heapifyAnimations(arr, n, i) {
        let largest = i;
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        
        if (left < n) {
            this.animations.push({
                type: 'compare',
                indices: [left, largest],
                color: 'comparing'
            });
            
            this.stats.comparisons++;
            this.stats.arrayAccesses += 2;
            
            if (arr[left] > arr[largest]) {
                largest = left;
            }
        }
        
        if (right < n) {
            this.animations.push({
                type: 'compare',
                indices: [right, largest],
                color: 'comparing'
            });
            
            this.stats.comparisons++;
            this.stats.arrayAccesses += 2;
            
            if (arr[right] > arr[largest]) {
                largest = right;
            }
        }
        
        if (largest !== i) {
            this.animations.push({
                type: 'swap',
                indices: [i, largest],
                color: 'swapping'
            });
            
            [arr[i], arr[largest]] = [arr[largest], arr[i]];
            this.stats.swaps++;
            
            await this.heapifyAnimations(arr, n, largest);
        }
    }
    
    async bubbleSortAnimations(arr) {
        const n = arr.length;
        
        for (let i = 0; i < n - 1; i++) {
            for (let j = 0; j < n - i - 1; j++) {
                this.animations.push({
                    type: 'compare',
                    indices: [j, j + 1],
                    color: 'comparing'
                });
                
                this.stats.comparisons++;
                this.stats.arrayAccesses += 2;
                
                if (arr[j] > arr[j + 1]) {
                    this.animations.push({
                        type: 'swap',
                        indices: [j, j + 1],
                        color: 'swapping'
                    });
                    
                    [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
                    this.stats.swaps++;
                }
            }
            
            this.animations.push({
                type: 'sorted',
                indices: [n - i - 1],
                color: 'sorted'
            });
        }
        
        this.animations.push({
            type: 'sorted',
            indices: [0],
            color: 'sorted'
        });
    }
    
    async playAnimations() {
        const sortedIndices = new Set();
        
        for (let i = 0; i < this.animations.length; i++) {
            if (!this.sorting) break;
            
            while (this.paused) {
                await this.sleep(100);
            }
            
            const animation = this.animations[i];
            
            if (animation.type === 'compare' || animation.type === 'highlight') {
                this.draw(animation.indices, animation.color);
                if (this.soundEnabled) this.playSound('compare');
            } else if (animation.type === 'swap') {
                const [i, j] = animation.indices;
                [this.array[i], this.array[j]] = [this.array[j], this.array[i]];
                this.draw(animation.indices, animation.color);
                if (this.soundEnabled) this.playSound('swap');
            } else if (animation.type === 'update') {
                this.array[animation.index] = animation.value;
                this.draw([animation.index], animation.color);
                if (this.soundEnabled) this.playSound('update');
            } else if (animation.type === 'sorted') {
                animation.indices.forEach(idx => sortedIndices.add(idx));
                this.draw([...sortedIndices], 'sorted');
            }
            
            this.updateStats();
            await this.sleep(101 - this.speed);
        }
        
        // Final sorted state
        this.draw(Array.from({length: this.arraySize}, (_, i) => i), 'sorted');
        if (this.soundEnabled) this.playSound('complete');
    }
    
    async compareAlgorithms() {
        const algorithms = ['quicksort', 'mergesort', 'heapsort', 'bubblesort'];
        const results = [];
        
        for (const algo of algorithms) {
            const arrayCopy = [...this.array];
            const startTime = performance.now();
            
            this.resetStats();
            
            switch (algo) {
                case 'quicksort':
                    this.quickSortForComparison(arrayCopy, 0, arrayCopy.length - 1);
                    break;
                case 'mergesort':
                    this.mergeSortForComparison(arrayCopy, 0, arrayCopy.length - 1);
                    break;
                case 'heapsort':
                    this.heapSortForComparison(arrayCopy);
                    break;
                case 'bubblesort':
                    this.bubbleSortForComparison(arrayCopy);
                    break;
            }
            
            const endTime = performance.now();
            
            results.push({
                algorithm: algo,
                time: (endTime - startTime).toFixed(2),
                comparisons: this.stats.comparisons,
                swaps: this.stats.swaps,
                arrayAccesses: this.stats.arrayAccesses
            });
        }
        
        this.displayComparisonResults(results);
    }
    
    // Comparison versions without animations
    quickSortForComparison(arr, left, right) {
        if (left >= right) return;
        
        const pivotIndex = this.partitionForComparison(arr, left, right);
        this.quickSortForComparison(arr, left, pivotIndex - 1);
        this.quickSortForComparison(arr, pivotIndex + 1, right);
    }
    
    partitionForComparison(arr, left, right) {
        const pivot = arr[right];
        let i = left - 1;
        
        for (let j = left; j < right; j++) {
            this.stats.comparisons++;
            this.stats.arrayAccesses += 2;
            
            if (arr[j] <= pivot) {
                i++;
                if (i !== j) {
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                    this.stats.swaps++;
                }
            }
        }
        
        if (i + 1 !== right) {
            [arr[i + 1], arr[right]] = [arr[right], arr[i + 1]];
            this.stats.swaps++;
        }
        
        return i + 1;
    }
    
    mergeSortForComparison(arr, left, right) {
        if (left >= right) return arr;
        
        const mid = Math.floor((left + right) / 2);
        this.mergeSortForComparison(arr, left, mid);
        this.mergeSortForComparison(arr, mid + 1, right);
        this.mergeForComparison(arr, left, mid, right);
    }
    
    mergeForComparison(arr, left, mid, right) {
        const leftArr = arr.slice(left, mid + 1);
        const rightArr = arr.slice(mid + 1, right + 1);
        
        let i = 0, j = 0, k = left;
        
        while (i < leftArr.length && j < rightArr.length) {
            this.stats.comparisons++;
            this.stats.arrayAccesses += 2;
            
            if (leftArr[i] <= rightArr[j]) {
                arr[k++] = leftArr[i++];
            } else {
                arr[k++] = rightArr[j++];
            }
        }
        
        while (i < leftArr.length) arr[k++] = leftArr[i++];
        while (j < rightArr.length) arr[k++] = rightArr[j++];
    }
    
    heapSortForComparison(arr) {
        const n = arr.length;
        
        for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
            this.heapifyForComparison(arr, n, i);
        }
        
        for (let i = n - 1; i > 0; i--) {
            [arr[0], arr[i]] = [arr[i], arr[0]];
            this.stats.swaps++;
            this.heapifyForComparison(arr, i, 0);
        }
    }
    
    heapifyForComparison(arr, n, i) {
        let largest = i;
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        
        if (left < n) {
            this.stats.comparisons++;
            this.stats.arrayAccesses += 2;
            if (arr[left] > arr[largest]) largest = left;
        }
        
        if (right < n) {
            this.stats.comparisons++;
            this.stats.arrayAccesses += 2;
            if (arr[right] > arr[largest]) largest = right;
        }
        
        if (largest !== i) {
            [arr[i], arr[largest]] = [arr[largest], arr[i]];
            this.stats.swaps++;
            this.heapifyForComparison(arr, n, largest);
        }
    }
    
    bubbleSortForComparison(arr) {
        const n = arr.length;
        
        for (let i = 0; i < n - 1; i++) {
            for (let j = 0; j < n - i - 1; j++) {
                this.stats.comparisons++;
                this.stats.arrayAccesses += 2;
                
                if (arr[j] > arr[j + 1]) {
                    [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
                    this.stats.swaps++;
                }
            }
        }
    }
    
    displayComparisonResults(results) {
        const container = document.getElementById('comparisonResults');
        container.innerHTML = '';
        
        results.forEach(result => {
            const card = document.createElement('div');
            card.className = 'algorithm-result';
            card.innerHTML = `
                <h3>${result.algorithm.charAt(0).toUpperCase() + result.algorithm.slice(1)}</h3>
                <div class="metric">
                    <span class="metric-label">Time:</span>
                    <span class="metric-value">${result.time}ms</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Comparisons:</span>
                    <span class="metric-value">${result.comparisons}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Swaps:</span>
                    <span class="metric-value">${result.swaps}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Array Accesses:</span>
                    <span class="metric-value">${result.arrayAccesses}</span>
                </div>
            `;
            container.appendChild(card);
        });
    }
    
    playSound(type) {
        if (!this.soundEnabled) return;
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        switch (type) {
            case 'compare':
                oscillator.frequency.value = 300;
                gainNode.gain.value = 0.1;
                break;
            case 'swap':
                oscillator.frequency.value = 500;
                gainNode.gain.value = 0.15;
                break;
            case 'update':
                oscillator.frequency.value = 400;
                gainNode.gain.value = 0.1;
                break;
            case 'complete':
                oscillator.frequency.value = 800;
                gainNode.gain.value = 0.2;
                break;
        }
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.05);
    }
    
    togglePause() {
        this.paused = !this.paused;
        document.getElementById('pauseBtn').textContent = this.paused ? 'Resume' : 'Pause';
    }
    
    reset() {
        this.sorting = false;
        this.paused = false;
        this.animations = [];
        this.currentAnimation = 0;
        this.generateArray();
        this.resetStats();
        this.setControlsEnabled(true);
        document.getElementById('pauseBtn').textContent = 'Pause';
    }
    
    resetStats() {
        this.stats = {
            comparisons: 0,
            swaps: 0,
            arrayAccesses: 0,
            startTime: 0,
            endTime: 0
        };
        this.updateStats();
    }
    
    updateStats() {
        document.getElementById('comparisons').textContent = this.stats.comparisons;
        document.getElementById('swaps').textContent = this.stats.swaps;
        document.getElementById('arrayAccesses').textContent = this.stats.arrayAccesses;
        
        if (this.stats.startTime > 0) {
            const elapsed = (this.stats.endTime || Date.now()) - this.stats.startTime;
            document.getElementById('timeElapsed').textContent = elapsed + 'ms';
        }
    }
    
    setControlsEnabled(enabled) {
        document.getElementById('generateBtn').disabled = !enabled;
        document.getElementById('sortBtn').disabled = !enabled;
        document.getElementById('resetBtn').disabled = !enabled;
        document.getElementById('algorithm').disabled = !enabled;
        document.getElementById('arraySize').disabled = !enabled;
        document.getElementById('dataPattern').disabled = !enabled;
        document.getElementById('pauseBtn').disabled = enabled;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize visualizer when page loads
document.addEventListener('DOMContentLoaded', () => {
    new SortingVisualizer();
});