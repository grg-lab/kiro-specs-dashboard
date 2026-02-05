/**
 * Generate Mock Velocity Data
 * 
 * This script generates realistic velocity data for the last 12 weeks
 * to test and visualize the Analytics tab with meaningful data.
 * 
 * Usage:
 * 1. Open VSCode with your workspace
 * 2. Open the Command Palette (Cmd+Shift+P)
 * 3. Run: Developer: Execute JavaScript in Extension Host
 * 4. Paste this script and run it
 * 
 * Or run from terminal:
 * node generate-mock-velocity-data.js
 */

// This needs to be run in the Extension Host context
// Copy the generateMockData function below and run it in the VSCode Extension Host

function generateMockData() {
    const vscode = require('vscode');
    
    // Get the extension context
    const extension = vscode.extensions.getExtension('your-publisher.kiro-specs-dashboard');
    if (!extension) {
        console.error('Extension not found');
        return;
    }
    
    const context = extension.exports?.context;
    if (!context) {
        console.error('Extension context not available');
        return;
    }
    
    const workspaceState = context.workspaceState;
    
    // Generate mock velocity data
    const mockData = {
        weeklyTasks: [],
        weeklySpecs: [],
        specActivity: {},
        dayOfWeekTasks: {
            monday: 0,
            tuesday: 0,
            wednesday: 0,
            thursday: 0,
            friday: 0,
            saturday: 0,
            sunday: 0
        },
        dailyTaskCounts: [],
        taskCompletionEvents: [],
        specLifecycleEvents: []
    };
    
    const today = new Date();
    const specNames = ['user-authentication', 'dashboard-ui', 'api-integration', 'data-migration', 'testing-suite'];
    
    // Generate 12 weeks of data
    for (let week = 11; week >= 0; week--) {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - (week * 7));
        weekStart.setHours(0, 0, 0, 0);
        
        // Adjust to Monday
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
        weekStart.setDate(diff);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // Generate realistic task counts (more recent weeks have more activity)
        const baseActivity = 5 + Math.floor(Math.random() * 5);
        const recencyBoost = Math.floor((12 - week) / 3);
        const completed = baseActivity + recencyBoost + Math.floor(Math.random() * 3);
        const required = Math.floor(completed * 0.7);
        const optional = completed - required;
        
        mockData.weeklyTasks.push({
            weekStart: weekStart.toISOString(),
            weekEnd: weekEnd.toISOString(),
            completed,
            required,
            optional
        });
        
        // Generate daily data for this week
        for (let day = 0; day < 7; day++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + day);
            
            const dailyTasks = Math.floor(Math.random() * 4);
            const dailyRequired = Math.floor(dailyTasks * 0.7);
            const dailyOptional = dailyTasks - dailyRequired;
            
            if (dailyTasks > 0) {
                const dateStr = date.toISOString().split('T')[0];
                mockData.dailyTaskCounts.push({
                    date: dateStr,
                    completed: dailyTasks,
                    required: dailyRequired,
                    optional: dailyOptional
                });
                
                // Update day of week totals
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const dayName = dayNames[date.getDay()];
                mockData.dayOfWeekTasks[dayName] += dailyTasks;
                
                // Generate task completion events
                for (let t = 0; t < dailyTasks; t++) {
                    const timestamp = new Date(date);
                    timestamp.setHours(9 + Math.floor(Math.random() * 8));
                    timestamp.setMinutes(Math.floor(Math.random() * 60));
                    
                    const specName = specNames[Math.floor(Math.random() * specNames.length)];
                    const taskDescriptions = [
                        'Implement login functionality',
                        'Add user authentication',
                        'Create dashboard layout',
                        'Integrate API endpoints',
                        'Write unit tests',
                        'Update documentation',
                        'Fix bug in validation',
                        'Optimize database queries',
                        'Add error handling',
                        'Refactor component structure'
                    ];
                    
                    mockData.taskCompletionEvents.push({
                        timestamp: timestamp.toISOString(),
                        specName,
                        taskId: `task-${week}-${day}-${t}`,
                        taskDescription: taskDescriptions[Math.floor(Math.random() * taskDescriptions.length)],
                        isRequired: t < dailyRequired
                    });
                }
            }
        }
        
        // Generate spec completions (1-2 per week randomly)
        if (Math.random() > 0.6) {
            const specsCompleted = Math.floor(Math.random() * 2) + 1;
            mockData.weeklySpecs.push({
                weekStart: weekStart.toISOString(),
                weekEnd: weekEnd.toISOString(),
                completed: specsCompleted,
                started: 0
            });
        }
    }
    
    // Generate spec activity
    specNames.forEach((specName, index) => {
        const startWeek = Math.floor(Math.random() * 8);
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - (startWeek * 7));
        
        const totalTasks = 10 + Math.floor(Math.random() * 15);
        const completedTasks = Math.floor(totalTasks * (0.3 + Math.random() * 0.7));
        const isCompleted = completedTasks === totalTasks;
        
        mockData.specActivity[specName] = {
            firstTaskDate: startDate.toISOString(),
            lastTaskDate: new Date().toISOString(),
            completionDate: isCompleted ? new Date().toISOString() : null,
            totalTasks,
            completedTasks
        };
        
        // Add lifecycle events
        mockData.specLifecycleEvents.push({
            specName,
            eventType: 'started',
            timestamp: startDate.toISOString(),
            progress: 0
        });
        
        if (isCompleted) {
            mockData.specLifecycleEvents.push({
                specName,
                eventType: 'completed',
                timestamp: new Date().toISOString(),
                progress: 100
            });
        }
    });
    
    // Keep only last 100 events
    mockData.taskCompletionEvents = mockData.taskCompletionEvents.slice(-100);
    
    // Save to workspace state
    workspaceState.update('velocityData', mockData).then(() => {
        vscode.window.showInformationMessage('Mock velocity data generated! Refresh the Analytics panel to see the data.');
        console.log('Mock data generated successfully!');
        console.log('Total weeks:', mockData.weeklyTasks.length);
        console.log('Total daily counts:', mockData.dailyTaskCounts.length);
        console.log('Total events:', mockData.taskCompletionEvents.length);
        console.log('Total specs:', Object.keys(mockData.specActivity).length);
    });
}

// For standalone execution (won't work, needs Extension Host context)
if (typeof module !== 'undefined' && module.exports) {
    console.log('This script needs to be run in the VSCode Extension Host context.');
    console.log('');
    console.log('Instructions:');
    console.log('1. Open VSCode with your workspace');
    console.log('2. Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)');
    console.log('3. Type: Developer: Execute JavaScript in Extension Host');
    console.log('4. Copy and paste the generateMockData function from this file');
    console.log('5. Call generateMockData() at the end');
    console.log('');
    console.log('Or use the simpler approach below:');
    console.log('');
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateMockData };
}
