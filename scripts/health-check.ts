#!/usr/bin/env tsx
import { performHealthCheck } from '../src/utils/healthCheck';

performHealthCheck().catch(console.error);