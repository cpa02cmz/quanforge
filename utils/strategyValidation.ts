import { StrategyParams } from '../types';
import { ValidationError } from './validationTypes';
import { validateRequired, validateRange, validateRegex, validateInSet } from './validationHelpers';

// Validation constants
const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'] as const;
const TIMEFRAMES_SET = new Set(TIMEFRAMES);
const SYMBOL_REGEX = /^[A-Z]{3,6}\/?[A-Z]{3,6}$/;
const MAX_RISK_PERCENT = 100;
const MIN_RISK_PERCENT = 0.01;
const MAX_STOP_LOSS = 1000;
const MIN_STOP_LOSS = 1;
const MAX_TAKE_PROFIT = 1000;
const MIN_TAKE_PROFIT = 1;
const MAX_MAGIC_NUMBER = 999999;
const MIN_MAGIC_NUMBER = 1;

// Strategy params validation
export const validateStrategyParams = (params: StrategyParams): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Validate timeframe
  const timeframeError = validateInSet(
    params.timeframe,
    'timeframe',
    TIMEFRAMES_SET,
    `Invalid timeframe. Must be one of: ${TIMEFRAMES.join(', ')}`
  );
  if (timeframeError) errors.push(timeframeError);

  // Validate symbol
  const symbolError = validateRequired(params.symbol, 'symbol');
  if (symbolError) {
    errors.push(symbolError);
  } else {
    // Optimize regex by pre-processing the string
    const cleanSymbol = params.symbol.replace('USDT', '').replace('BUSD', '');
    const regexError = validateRegex(
      cleanSymbol,
      'symbol',
      SYMBOL_REGEX,
      'Invalid symbol format. Use format like BTCUSD, EUR/USD, etc.'
    );
    if (regexError) errors.push(regexError);
  }

  // Validate risk percent
  const riskError = validateRange(
    params.riskPercent,
    'riskPercent',
    MIN_RISK_PERCENT,
    MAX_RISK_PERCENT
  );
  if (riskError) errors.push(riskError);

  // Validate stop loss
  const stopLossError = validateRange(
    params.stopLoss,
    'stopLoss',
    MIN_STOP_LOSS,
    MAX_STOP_LOSS
  );
  if (stopLossError) errors.push(stopLossError);

  // Validate take profit
  const takeProfitError = validateRange(
    params.takeProfit,
    'takeProfit',
    MIN_TAKE_PROFIT,
    MAX_TAKE_PROFIT
  );
  if (takeProfitError) errors.push(takeProfitError);

  // Validate magic number
  const magicNumberError = validateRange(
    params.magicNumber,
    'magicNumber',
    MIN_MAGIC_NUMBER,
    MAX_MAGIC_NUMBER
  );
  if (magicNumberError) errors.push(magicNumberError);

  // Validate custom inputs
  params.customInputs.forEach((input, index) => {
    if (!input.name || input.name.trim().length === 0) {
      errors.push({
        field: `customInputs[${index}].name`,
        message: 'Custom input name is required'
      });
    }

    if (!input.value || input.value.trim().length === 0) {
      errors.push({
        field: `customInputs[${index}].value`,
        message: 'Custom input value is required'
      });
    }

    // Type-specific validation
    if (input.type === 'int' || input.type === 'double') {
      const numValue = parseFloat(input.value);
      if (isNaN(numValue)) {
        errors.push({
          field: `customInputs[${index}].value`,
          message: `Value must be a valid number for ${input.type} type`
        });
      }
    }
  });

  return errors;
};