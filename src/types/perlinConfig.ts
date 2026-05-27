export interface PerlinStateSpace {
  scale: { min: number; max: number; step: number };
  threshold: { min: number; max: number; step: number };
  octaves: { min: number; max: number; step: number };
  amplitudeDecay: { min: number; max: number; step: number };
}

export interface PerlinCondition {
  comment: string;
  type: 'interval_active' | 'cell_must_be_inactive' | 'cell_must_be_active';
  min?: number;
  max?: number;
  cells: string[];
}

export interface PerlinConfig {
  state_space: PerlinStateSpace;
  conditions: PerlinCondition[];
}

export interface TileGroup {
  condition: PerlinCondition;
  color: string;
}