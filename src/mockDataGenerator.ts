import * as vscode from 'vscode';
import { StateManager } from './stateManager';

/**
 * Generate mock velocity data for testing the Analytics tab
 * 
 * This creates realistic data for the last 12 weeks including:
 * - Weekly task completions
 * - Daily activity for heatmap
 * - Task completion events for activity stream
 * - Spec lifecycle events for timeline
 */
export async function generateMockVelocityData(stateManager: StateManager): Promise<void> {
    const mockData = {
        weeklyTasks: [] as any[],
        weeklySpecs: [] as any[],
        specActivity: {} as any,
        dayOfWeekTasks: {
            monday: 0,
            tuesday: 0,
            wednesday: 0,
            thursday: 0,
            friday: 0,
            saturday: 0,
            sunday: 0
        },
        dailyTaskCounts: [] as any[],
        taskCompletionEvents: [] as any[],
        specLifecycleEvents: [] as any[]
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
                const dayName = dayNames[date.getDay()] as keyof typeof mockData.dayOfWeekTasks;
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
        
        // Generate spec completions (0-2 per week with realistic distribution)
        // More recent weeks have higher chance of completions
        const completionChance = 0.3 + ((12 - week) / 12) * 0.5; // 30-80% chance
        let specsCompleted = 0;
        
        if (Math.random() < completionChance) {
            // 70% chance of 1 spec, 30% chance of 2 specs
            specsCompleted = Math.random() < 0.7 ? 1 : 2;
        }
        
        mockData.weeklySpecs.push({
            weekStart: weekStart.toISOString(),
            weekEnd: weekEnd.toISOString(),
            completed: specsCompleted,
            started: 0
        });
    }
    
    // Generate spec activity with more realistic completion patterns
    const completedSpecsCount = mockData.weeklySpecs.reduce((sum, week) => sum + week.completed, 0);
    let specsToComplete = Math.min(completedSpecsCount, specNames.length);
    
    specNames.forEach((specName, index) => {
        const startWeek = 11 - Math.floor(Math.random() * 10); // Started 0-10 weeks ago
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - (startWeek * 7));
        startDate.setHours(9, 0, 0, 0);
        
        const totalTasks = 10 + Math.floor(Math.random() * 15);
        
        // Determine if this spec should be completed
        const shouldComplete = index < specsToComplete;
        const completedTasks = shouldComplete 
            ? totalTasks 
            : Math.floor(totalTasks * (0.3 + Math.random() * 0.6)); // 30-90% complete
        
        const isCompleted = completedTasks === totalTasks;
        
        // Calculate completion date (between start and now)
        let completionDate = null;
        if (isCompleted) {
            const daysToComplete = 7 + Math.floor(Math.random() * (startWeek * 7 - 7));
            completionDate = new Date(startDate);
            completionDate.setDate(completionDate.getDate() + daysToComplete);
            completionDate.setHours(16, 0, 0, 0);
        }
        
        const lastTaskDate = isCompleted ? completionDate : new Date();
        
        mockData.specActivity[specName] = {
            firstTaskDate: startDate.toISOString(),
            lastTaskDate: lastTaskDate!.toISOString(),
            completionDate: completionDate ? completionDate.toISOString() : null,
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
                timestamp: completionDate!.toISOString(),
                progress: 100
            });
        }
    });
    
    // Keep only last 100 events
    mockData.taskCompletionEvents = mockData.taskCompletionEvents.slice(-100);
    
    // Save to workspace state
    await stateManager.saveVelocityData(mockData);
    
    const totalSpecsCompleted = mockData.weeklySpecs.reduce((sum, week) => sum + week.completed, 0);
    
    vscode.window.showInformationMessage(
        `Mock velocity data generated! ${mockData.weeklyTasks.length} weeks, ${totalSpecsCompleted} specs completed, ${mockData.dailyTaskCounts.length} days with activity, ${mockData.taskCompletionEvents.length} events. Refresh Analytics to see it.`
    );
    
    console.log('Mock velocity data generated:');
    console.log('- Weeks:', mockData.weeklyTasks.length);
    console.log('- Specs completed:', totalSpecsCompleted);
    console.log('- Daily counts:', mockData.dailyTaskCounts.length);
    console.log('- Events:', mockData.taskCompletionEvents.length);
    console.log('- Specs tracked:', Object.keys(mockData.specActivity).length);
}
