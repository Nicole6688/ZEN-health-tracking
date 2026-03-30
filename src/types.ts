export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  weight?: number;
  height?: number;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal?: 'lose' | 'maintain' | 'gain';
  createdAt: string;
}

export interface DietLog {
  id?: string;
  uid: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodName: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  timestamp: string;
}

export interface ExerciseLog {
  id?: string;
  uid: string;
  date: string;
  activityType: string;
  duration: number;
  caloriesBurned: number;
  timestamp: string;
}

export interface WeightLog {
  id?: string;
  uid: string;
  date: string;
  weight: number;
  timestamp: string;
}

export interface MenstrualLog {
  id?: string;
  uid: string;
  date: string;
  flow?: 'light' | 'medium' | 'heavy' | 'spotting';
  symptoms?: string[];
  notes?: string;
  timestamp: string;
}
