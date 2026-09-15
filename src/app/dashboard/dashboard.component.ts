import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { DashboardDataService } from '../services/dashboard-data.service';
import { Subscription } from 'rxjs';

export interface Workout {
  id: string;
  title: string;
  category: string;
  status: 'Completed' | 'Planned';
  minutes: number;
  calories: number;
  startedAt: string; // ISO string YYYY-MM-DDTHH:mm
  notes?: string;
}

export interface UserSettings {
  name: string;
  calorieGoal: number;
  minutesGoal: number;
  waterGoalMl: number;
}

function getISO(daysAgo: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private auth = inject(AuthService);
  private dashboardData = inject(DashboardDataService);
  private authSubscription?: Subscription;

  // Real-Time System Telemetry
  currentTimeDisplay = '';
  timeOfDayGreeting = '';
  isLiveConnected = true;

  // Real-Time Heart Rate Monitor & Sensor State
  heartRate = 72;
  heartRateZone = 'Resting (Zone 1)';
  liveBurnRate = 1.2;
  ecgPoints: number[] = [20, 25, 20, 55, 10, 30, 20, 22, 20, 25, 20, 22];

  private realTimeInterval: any = null;
  private heartInterval: any = null;

  // User Settings
  settings: UserSettings = {
    name: '',
    calorieGoal: 800,
    minutesGoal: 45,
    waterGoalMl: 3000
  };

  settingsDraft: UserSettings = { ...this.settings };
  showSettingsModal = false;

  // Workouts List - Clean slate for user real workout logging
  workouts: Workout[] = [];

  // Categories Filter Options
  categories: string[] = ['Cardio', 'Strength', 'Cycling', 'Running', 'HIIT', 'Yoga', 'Walking', 'Swimming'];

  // Filters State
  search = '';
  categoryFilter = 'All';
  statusFilter = 'All';
  sortKey = 'recent';

  // Workout Modal State
  showWorkoutModal = false;
  editingId: string | null = null;
  formError: string | null = null;
  draft = {
    title: '',
    category: 'Cardio',
    status: 'Completed' as 'Completed' | 'Planned',
    minutes: null as number | null,
    calories: null as number | null,
    startedAt: getISO(0, new Date().getHours(), new Date().getMinutes()),
    notes: ''
  };

  // Toast Notification State
  toastText: string | null = null;
  toastActionLabel: string | null = null;
  private deletedWorkoutBackup: { workout: Workout; index: number } | null = null;
  private toastTimeout: any = null;

  // Stopwatch / Live Timer State
  timerRunning = false;
  elapsedMs = 0;
  laps: number[] = [];
  private timerInterval: any = null;

  // Water Hydration Tracker - Clean slate
  todayWaterMl = 0;
  waterHistory: number[] = [];
  customWaterMl: number | null = null;

  ngOnInit(): void {
    this.authSubscription = this.auth.user$.subscribe((user) => {
      const name = user?.displayName || this.auth.currentUserName;
      if (name) {
        this.settings.name = name;
        this.settingsDraft = { ...this.settings };
        this.cdr.markForCheck();
      }
    });
    void this.loadFromFirebase();
    this.initRealTimeClock();
    this.initRealTimeHeartRate();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    if (this.realTimeInterval) clearInterval(this.realTimeInterval);
    if (this.heartInterval) clearInterval(this.heartInterval);
    this.authSubscription?.unsubscribe();
  }

  // Real-Time Clock & Heart Rate Telemetry Init
  private initRealTimeClock(): void {
    this.updateClock();
    this.realTimeInterval = setInterval(() => {
      this.updateClock();
    }, 1000);
  }

  private updateClock(): void {
    const now = new Date();
    this.currentTimeDisplay = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const hours = now.getHours();
    if (hours < 12) {
      this.timeOfDayGreeting = 'Good Morning';
    } else if (hours < 18) {
      this.timeOfDayGreeting = 'Good Afternoon';
    } else {
      this.timeOfDayGreeting = 'Good Evening';
    }
    this.cdr.markForCheck();
  }

  private initRealTimeHeartRate(): void {
    this.updateHeartRate();
    this.heartInterval = setInterval(() => {
      this.updateHeartRate();
    }, 1500);
  }

  private updateHeartRate(): void {
    if (this.timerRunning) {
      const targetBpm = 132 + Math.floor(Math.sin(Date.now() / 1500) * 14);
      this.heartRate = targetBpm;
      this.liveBurnRate = parseFloat((targetBpm * 0.062).toFixed(1));

      if (this.heartRate >= 140) {
        this.heartRateZone = 'Anaerobic (Zone 4)';
      } else if (this.heartRate >= 120) {
        this.heartRateZone = 'Aerobic Burn (Zone 3)';
      } else {
        this.heartRateZone = 'Warmup (Zone 2)';
      }
    } else {
      const delta = Math.floor((Math.random() - 0.5) * 4);
      this.heartRate = Math.min(82, Math.max(65, this.heartRate + delta));
      this.liveBurnRate = 1.2;
      this.heartRateZone = 'Resting (Zone 1)';
    }

    const spike = this.timerRunning
      ? (Math.random() > 0.5 ? 45 : 12)
      : (Math.random() > 0.75 ? 35 : 15);
    this.ecgPoints.push(spike);
    if (this.ecgPoints.length > 14) {
      this.ecgPoints.shift();
    }
    this.cdr.markForCheck();
  }

  get ecgSvgPath(): string {
    const points = this.ecgPoints;
    const width = 120;
    const step = width / (points.length - 1);
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${45 - p}`).join(' ');
  }

  // AI Coach & Quick Presets
  get aiCoachAdvice(): string {
    const calPct = this.caloriePct;
    const watPct = this.waterPct;
    if (this.timerRunning) {
      return '⚡ Live workout active! Maintain your breathing pace and stay hydrated.';
    }
    if (watPct < 50) {
      return `💧 Hydration check: You are at ${watPct}% of your water goal. Log +500ml now to stay optimized!`;
    }
    if (calPct >= 100) {
      return `🔥 Outstanding! You've crushed 100% of today's calorie goal (${this.todayCalories} kcal burned)!`;
    }
    if (calPct >= 50) {
      return `💪 Solid progress! You are ${100 - calPct}% away from your daily goal. An evening ride or run will seal it!`;
    }
    return `🚀 Ready for today's session? Log a quick preset or start the live timer to get moving!`;
  }

  quickLogPreset(title: string, category: string, minutes: number, calories: number): void {
    const newW: Workout = {
      id: 'act-' + Date.now(),
      title,
      category,
      status: 'Completed',
      minutes,
      calories,
      startedAt: getISO(0, new Date().getHours(), new Date().getMinutes()),
      notes: 'Logged via Quick Preset'
    };
    this.workouts.unshift(newW);
    void this.saveToFirebase();
    this.showToast(`Quick logged "${title}" (+${calories} kcal)!`);
  }

  // Identity & Greetings
  get greetingName(): string {
    if (!this.settings.name) return 'User';
    return this.settings.name.trim().split(' ')[0];
  }

  get initials(): string {
    if (!this.settings.name) return 'TM';
    const parts = this.settings.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  get hasWorkouts(): boolean {
    return this.workouts.length > 0;
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  }

  get completedToday(): number {
    const today = new Date();
    return this.workouts.filter(w => w.status === 'Completed' && this.isSameDay(new Date(w.startedAt), today)).length;
  }

  get plannedAhead(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.workouts.filter(w => w.status === 'Planned' && new Date(w.startedAt) >= today).length;
  }

  get streak(): number {
    const completed = this.workouts.filter(w => w.status === 'Completed');
    if (completed.length === 0) return 0;

    const dates = Array.from(new Set(completed.map(w => {
      const d = new Date(w.startedAt);
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    }))).sort().reverse();

    const todayStr = getISO(0, 0, 0).slice(0, 10);
    const yesterdayStr = getISO(1, 0, 0).slice(0, 10);

    if (!dates.includes(todayStr) && !dates.includes(yesterdayStr)) {
      return 0;
    }

    let currentStreak = 0;
    let checkDate = new Date();
    if (!dates.includes(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const ds = `${checkDate.getFullYear()}-${pad(checkDate.getMonth() + 1)}-${pad(checkDate.getDate())}`;
      if (dates.includes(ds)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return currentStreak;
  }

  // Daily Dashboard Stats
  get todayCalories(): number {
    const today = new Date();
    const logged = this.workouts
      .filter(w => w.status === 'Completed' && this.isSameDay(new Date(w.startedAt), today))
      .reduce((sum, w) => sum + (w.calories || 0), 0);

    // Live Stopwatch accumulator
    const liveStopwatchCals = this.timerRunning ? Math.floor(this.elapsedMs / 1000 * 0.15) : 0;
    return logged + liveStopwatchCals;
  }

  get caloriePct(): number {
    const goal = this.settings.calorieGoal || 1;
    return Math.min(100, Math.round((this.todayCalories / goal) * 100));
  }

  get todayMinutes(): number {
    const today = new Date();
    const logged = this.workouts
      .filter(w => w.status === 'Completed' && this.isSameDay(new Date(w.startedAt), today))
      .reduce((sum, w) => sum + (w.minutes || 0), 0);

    const liveMins = this.timerRunning ? Math.floor(this.elapsedMs / 60000) : 0;
    return logged + liveMins;
  }

  get minutesPct(): number {
    const goal = this.settings.minutesGoal || 1;
    return Math.min(100, Math.round((this.todayMinutes / goal) * 100));
  }

  get waterPct(): number {
    const goal = this.settings.waterGoalMl || 1;
    return Math.min(100, Math.round((this.todayWaterMl / goal) * 100));
  }

  formatLitres(ml: number): string {
    return ((ml || 0) / 1000).toFixed(1);
  }

  get weekSessions(): number {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    return this.workouts.filter(w => w.status === 'Completed' && new Date(w.startedAt) >= sevenDaysAgo).length;
  }

  get weekCalories(): number {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    return this.workouts
      .filter(w => w.status === 'Completed' && new Date(w.startedAt) >= sevenDaysAgo)
      .reduce((sum, w) => sum + (w.calories || 0), 0);
  }

  // 7-Day Weekly Chart
  get weekBars() {
    const days = [];
    const now = new Date();

    let maxCalories = this.settings.calorieGoal || 800;
    const dailyTotals: { [key: string]: { calories: number; minutes: number } } = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      dailyTotals[key] = { calories: 0, minutes: 0 };
    }

    this.workouts.forEach(w => {
      if (w.status === 'Completed') {
        const d = new Date(w.startedAt);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (dailyTotals[key]) {
          dailyTotals[key].calories += w.calories || 0;
          dailyTotals[key].minutes += w.minutes || 0;
        }
      }
    });

    Object.values(dailyTotals).forEach(t => {
      if (t.calories > maxCalories) {
        maxCalories = t.calories;
      }
    });

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const stats = dailyTotals[key] || { calories: 0, minutes: 0 };

      if (i === 0 && this.timerRunning) {
        stats.calories += Math.floor(this.elapsedMs / 1000 * 0.15);
      }

      const height = maxCalories > 0 ? Math.min(100, Math.max(6, Math.round((stats.calories / maxCalories) * 100))) : 6;

      days.push({
        label: i === 0 ? 'Today' : dayLabels[d.getDay()],
        calories: stats.calories,
        minutes: stats.minutes,
        height,
        hit: stats.calories >= this.settings.calorieGoal,
        isToday: i === 0,
        key
      });
    }

    return days;
  }

  trackByKey(index: number, item: any): string {
    return item.key;
  }

  // Filtering & Sorting
  get filtersActive(): boolean {
    return this.search.trim() !== '' || this.categoryFilter !== 'All' || this.statusFilter !== 'All' || this.sortKey !== 'recent';
  }

  applyFilters(): void {
    // Computed dynamically via visible getter
  }

  clearFilters(): void {
    this.search = '';
    this.categoryFilter = 'All';
    this.statusFilter = 'All';
    this.sortKey = 'recent';
  }

  get visible(): Workout[] {
    return this.workouts
      .filter(w => {
        if (this.categoryFilter !== 'All' && w.category !== this.categoryFilter) {
          return false;
        }
        if (this.statusFilter !== 'All' && w.status !== this.statusFilter) {
          return false;
        }
        if (this.search.trim()) {
          const q = this.search.toLowerCase().trim();
          const matchTitle = w.title.toLowerCase().includes(q);
          const matchCategory = w.category.toLowerCase().includes(q);
          const matchNotes = w.notes ? w.notes.toLowerCase().includes(q) : false;
          if (!matchTitle && !matchCategory && !matchNotes) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (this.sortKey === 'calories') {
          return b.calories - a.calories;
        }
        if (this.sortKey === 'minutes') {
          return b.minutes - a.minutes;
        }
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      });
  }

  trackById(index: number, item: Workout): string {
    return item.id;
  }

  iconFor(category: string): string {
    const map: Record<string, string> = {
      Cardio: 'bi-lightning-charge-fill',
      Strength: 'bi-bar-chart-line-fill',
      Cycling: 'bi-bicycle',
      Running: 'bi-person-walking',
      HIIT: 'bi-fire',
      Yoga: 'bi-heart-pulse-fill',
      Walking: 'bi-person-walk',
      Swimming: 'bi-water'
    };
    return map[category] || 'bi-activity';
  }

  formatWhen(startedAt: string): string {
    if (!startedAt) return '';
    const d = new Date(startedAt);
    if (isNaN(d.getTime())) return startedAt;

    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (d.toDateString() === todayStr) {
      return `Today, ${timeStr}`;
    } else if (d.toDateString() === yesterdayStr) {
      return `Yesterday, ${timeStr}`;
    } else {
      const month = d.toLocaleDateString([], { month: 'short' });
      const day = d.getDate();
      return `${month} ${day}, ${timeStr}`;
    }
  }

  toggleStatus(w: Workout): void {
    w.status = w.status === 'Completed' ? 'Planned' : 'Completed';
    void this.saveToFirebase();
    this.showToast(`Session "${w.title}" marked as ${w.status}`);
  }

  duplicateWorkout(w: Workout): void {
    const dup: Workout = {
      ...w,
      id: 'act-' + Date.now(),
      startedAt: getISO(0, new Date().getHours(), new Date().getMinutes()),
      status: 'Completed'
    };
    this.workouts.unshift(dup);
    void this.saveToFirebase();
    this.showToast(`Repeated "${w.title}" for today (+${dup.calories} kcal)!`);
  }

  deleteWorkout(w: Workout): void {
    const index = this.workouts.findIndex(item => item.id === w.id);
    if (index !== -1) {
      this.deletedWorkoutBackup = { workout: w, index };
      this.workouts.splice(index, 1);
      void this.saveToFirebase();
      this.showToast(`Deleted "${w.title}"`, 'Undo');
    }
  }

  undoDelete(): void {
    if (this.deletedWorkoutBackup) {
      this.workouts.splice(this.deletedWorkoutBackup.index, 0, this.deletedWorkoutBackup.workout);
      this.deletedWorkoutBackup = null;
      void this.saveToFirebase();
      this.showToast('Session restored!');
    }
  }

  // Workout Modal Handlers
  openWorkoutModal(w?: Workout): void {
    if (w) {
      this.editingId = w.id;
      this.draft = {
        title: w.title,
        category: w.category,
        status: w.status,
        minutes: w.minutes,
        calories: w.calories,
        startedAt: w.startedAt,
        notes: w.notes || ''
      };
    } else {
      this.editingId = null;
      this.draft = {
        title: '',
        category: 'Cardio',
        status: 'Completed',
        minutes: 45,
        calories: 380,
        startedAt: getISO(0, new Date().getHours(), new Date().getMinutes()),
        notes: ''
      };
    }
    this.formError = null;
    this.showWorkoutModal = true;
  }

  closeWorkoutModal(): void {
    this.showWorkoutModal = false;
    this.editingId = null;
    this.formError = null;
  }

  saveWorkout(): void {
    if (!this.draft.title.trim()) {
      this.formError = 'Please provide a session name.';
      return;
    }
    if (!this.draft.minutes || this.draft.minutes <= 0) {
      this.formError = 'Please enter a valid duration in minutes.';
      return;
    }
    if (this.draft.calories === null || this.draft.calories < 0) {
      this.formError = 'Please enter valid calories burned.';
      return;
    }

    if (this.editingId) {
      const idx = this.workouts.findIndex(w => w.id === this.editingId);
      if (idx !== -1) {
        this.workouts[idx] = {
          ...this.workouts[idx],
          title: this.draft.title.trim(),
          category: this.draft.category,
          status: this.draft.status,
          minutes: Number(this.draft.minutes),
          calories: Number(this.draft.calories),
          startedAt: this.draft.startedAt || getISO(0, new Date().getHours(), new Date().getMinutes()),
          notes: this.draft.notes.trim() || undefined
        };
        this.showToast(`Updated session "${this.draft.title}"`);
      }
    } else {
      const newW: Workout = {
        id: 'act-' + Date.now(),
        title: this.draft.title.trim(),
        category: this.draft.category,
        status: this.draft.status,
        minutes: Number(this.draft.minutes),
        calories: Number(this.draft.calories),
        startedAt: this.draft.startedAt || getISO(0, new Date().getHours(), new Date().getMinutes()),
        notes: this.draft.notes.trim() || undefined
      };
      this.workouts.unshift(newW);
      this.showToast(`Logged new session "${newW.title}"!`);
    }

    void this.saveToFirebase();
    this.closeWorkoutModal();
  }

  // Live Stopwatch / Timer
  toggleTimer(): void {
    if (this.timerRunning) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerRunning = false;
      this.cdr.detectChanges();
      this.showToast(`Timer paused at ${this.formatClock(this.elapsedMs)}`);
    } else {
      this.timerRunning = true;
      const startTime = Date.now() - this.elapsedMs;
      this.timerInterval = setInterval(() => {
        this.elapsedMs = Date.now() - startTime;
        this.cdr.detectChanges();
      }, 50);
      this.cdr.detectChanges();
    }
  }

  formatClock(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const tenths = Math.floor((ms % 1000) / 100);

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (h > 0) {
      return `${h}:${pad(m)}:${pad(s)}.${tenths}`;
    }
    return `${pad(m)}:${pad(s)}.${tenths}`;
  }

  addLap(): void {
    if (this.elapsedMs > 0) {
      this.laps.unshift(this.elapsedMs);
      this.cdr.detectChanges();
    }
  }

  resetTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.timerRunning = false;
    this.elapsedMs = 0;
    this.laps = [];
    this.cdr.detectChanges();
  }

  logTimedSession(): void {
    const mins = Math.max(1, Math.round(this.elapsedMs / 60000));
    const estimatedCals = Math.max(10, Math.floor(this.elapsedMs / 1000 * 0.15));

    this.draft = {
      title: 'Live Timed Workout',
      category: 'Cardio',
      status: 'Completed',
      minutes: mins,
      calories: estimatedCals,
      startedAt: getISO(0, new Date().getHours(), new Date().getMinutes()),
      notes: `Recorded live telemetry (${this.formatClock(this.elapsedMs)})`
    };
    this.editingId = null;
    this.formError = null;
    this.showWorkoutModal = true;
    this.resetTimer();
  }

  // Water Hydration Tracker
  addWater(amountMl: number): void {
    this.todayWaterMl += amountMl;
    this.waterHistory.push(amountMl);
    void this.saveToFirebase();
    this.showToast(`+${amountMl} ml water logged. Stay hydrated!`);
  }

  addCustomWater(): void {
    if (this.customWaterMl && this.customWaterMl > 0) {
      this.addWater(this.customWaterMl);
      this.customWaterMl = null;
    }
  }

  undoLastWater(): void {
    if (this.waterHistory.length > 0) {
      const last = this.waterHistory.pop()!;
      this.todayWaterMl = Math.max(0, this.todayWaterMl - last);
      void this.saveToFirebase();
      this.showToast(`Undid -${last} ml water entry.`);
    }
  }

  // Ranks & Achievements
  get lifetimeCalories(): number {
    return this.workouts
      .filter(w => w.status === 'Completed')
      .reduce((sum, w) => sum + (w.calories || 0), 0);
  }

  private readonly rankTiers = [
    { name: 'Rookie', threshold: 0 },
    { name: 'Bronze Titan', threshold: 1000 },
    { name: 'Silver Dynamo', threshold: 3000 },
    { name: 'Gold Vanguard', threshold: 7000 },
    { name: 'Platinum Legend', threshold: 15000 },
    { name: 'Diamond Apex', threshold: 30000 }
  ];

  get rankName(): string {
    const cals = this.lifetimeCalories;
    for (let i = this.rankTiers.length - 1; i >= 0; i--) {
      if (cals >= this.rankTiers[i].threshold) {
        return this.rankTiers[i].name;
      }
    }
    return 'Rookie';
  }

  get nextRankName(): string | null {
    const cals = this.lifetimeCalories;
    for (let i = 0; i < this.rankTiers.length; i++) {
      if (cals < this.rankTiers[i].threshold) {
        return this.rankTiers[i].name;
      }
    }
    return null;
  }

  get caloriesToNextRank(): number {
    const cals = this.lifetimeCalories;
    for (let i = 0; i < this.rankTiers.length; i++) {
      if (cals < this.rankTiers[i].threshold) {
        return this.rankTiers[i].threshold - cals;
      }
    }
    return 0;
  }

  get rankPct(): number {
    const cals = this.lifetimeCalories;
    let currentTierIdx = 0;

    for (let i = this.rankTiers.length - 1; i >= 0; i--) {
      if (cals >= this.rankTiers[i].threshold) {
        currentTierIdx = i;
        break;
      }
    }

    if (currentTierIdx === this.rankTiers.length - 1) {
      return 100;
    }

    const currentBase = this.rankTiers[currentTierIdx].threshold;
    const nextGoal = this.rankTiers[currentTierIdx + 1].threshold;
    const range = nextGoal - currentBase;

    return Math.min(100, Math.round(((cals - currentBase) / range) * 100));
  }

  // Training Mix Breakdown
  get split() {
    const categoryStats: { [cat: string]: { sessions: number; minutes: number; calories: number } } = {};
    let totalCalories = 0;

    this.workouts.forEach(w => {
      if (w.status === 'Completed') {
        if (!categoryStats[w.category]) {
          categoryStats[w.category] = { sessions: 0, minutes: 0, calories: 0 };
        }
        categoryStats[w.category].sessions += 1;
        categoryStats[w.category].minutes += w.minutes || 0;
        categoryStats[w.category].calories += w.calories || 0;
        totalCalories += w.calories || 0;
      }
    });

    return Object.keys(categoryStats)
      .map(category => {
        const stats = categoryStats[category];
        const share = totalCalories > 0 ? Math.round((stats.calories / totalCalories) * 100) : 0;
        return {
          category,
          share,
          sessions: stats.sessions,
          minutes: stats.minutes,
          calories: stats.calories
        };
      })
      .sort((a, b) => b.calories - a.calories);
  }

  trackByCategory(index: number, item: any): string {
    return item.category;
  }

  // Personal Bests
  get longestSession(): number {
    const completed = this.workouts.filter(w => w.status === 'Completed');
    if (completed.length === 0) return 0;
    return Math.max(...completed.map(w => w.minutes || 0));
  }

  get biggestBurn(): number {
    const completed = this.workouts.filter(w => w.status === 'Completed');
    if (completed.length === 0) return 0;
    return Math.max(...completed.map(w => w.calories || 0));
  }

  get bestDayCalories(): number {
    const completed = this.workouts.filter(w => w.status === 'Completed');
    if (completed.length === 0) return 0;

    const dayTotals: { [day: string]: number } = {};
    completed.forEach(w => {
      const d = new Date(w.startedAt);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      dayTotals[key] = (dayTotals[key] || 0) + (w.calories || 0);
    });

    return Math.max(...Object.values(dayTotals), 0);
  }

  // Settings Modal Handlers
  openSettingsModal(): void {
    this.settingsDraft = { ...this.settings };
    this.showSettingsModal = true;
  }

  closeSettingsModal(): void {
    this.showSettingsModal = false;
  }

  saveSettings(): void {
    if (!this.settingsDraft.name.trim()) {
      this.settingsDraft.name = this.firebaseUserName;
    }
    this.settings = {
      name: this.settingsDraft.name.trim(),
      calorieGoal: Number(this.settingsDraft.calorieGoal) || 800,
      minutesGoal: Number(this.settingsDraft.minutesGoal) || 45,
      waterGoalMl: Number(this.settingsDraft.waterGoalMl) || 3000
    };
    void this.saveToFirebase();
    this.closeSettingsModal();
    this.showToast('Fitness goals and settings saved!');
  }

  exportData(): void {
    const exportObject = {
      settings: this.settings,
      todayWaterMl: this.todayWaterMl,
      workouts: this.workouts
    };
    const jsonStr = JSON.stringify(exportObject, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trimfit-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Data exported successfully!');
  }

  resetEverything(): void {
    if (confirm('Are you sure you want to clear all workouts and reset history?')) {
      this.workouts = [];
      this.todayWaterMl = 0;
      this.waterHistory = [];
      void this.saveToFirebase();
      this.closeSettingsModal();
      this.showToast('All fitness history cleared.');
    }
  }

  // Toast Helpers
  dismissToast(): void {
    this.toastText = null;
    this.toastActionLabel = null;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  private showToast(msg: string, actionLabel: string | null = null): void {
    this.dismissToast();
    this.toastText = msg;
    this.toastActionLabel = actionLabel;
    this.toastTimeout = setTimeout(() => {
      this.dismissToast();
    }, 4500);
  }

  private async loadFromFirebase(): Promise<void> {
    try {
      const data = await this.dashboardData.load();
      const user = this.auth.currentUser;
      const firebaseUserName = this.firebaseUserName;

      if (data) {
        this.settings = data.settings;
        if (user?.displayName) {
          this.settings.name = user.displayName;
        } else if (!this.settings.name || this.settings.name === 'Alex Morgan') {
          this.settings.name = firebaseUserName;
        }
        this.workouts = data.workouts as Workout[];
        this.todayWaterMl = data.todayWaterMl;
        this.waterHistory = data.waterHistory || [];
      } else if (user) {
        this.settings.name = firebaseUserName;
      }

      this.settingsDraft = { ...this.settings };
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Firebase dashboard data could not be loaded', error);
      this.showToast('Unable to load your dashboard data from Firebase.');
    }
  }

  private get firebaseUserName(): string {
    return this.auth.currentUserName || 'User';
  }

  private async saveToFirebase(): Promise<void> {
    try {
      await this.dashboardData.save({
        settings: this.settings,
        todayWaterMl: this.todayWaterMl,
        waterHistory: this.waterHistory,
        workouts: this.workouts
      });
    } catch (error) {
      console.error('Firebase dashboard data could not be saved', error);
      this.showToast('Unable to save your dashboard data to Firebase.');
    }
  }
}
