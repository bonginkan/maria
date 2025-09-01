/**
 * Recipe Registry
 * Manages healing recipes and matching logic
 */

import { Issue, FixRecipe } from "../types";
import { LOW_RISK_RECIPES } from "./low-risk-recipes";
import { logger } from "../../../utils/logger";

export class RecipeRegistry {
  private recipes: Map<string, FixRecipe> = new Map();
  private recipesByType: Map<string, FixRecipe[]> = new Map();

  constructor() {
    this.loadDefaultRecipes();
  }

  /**
   * Load default recipes
   */
  loadDefaultRecipes(): void {
    try {
      for (const recipe of LOW_RISK_RECIPES) {
        this.registerRecipe(recipe);
      }
      logger.info(`Loaded ${this.recipes.size} default recipes`);
    } catch (error) {
      logger.error("Failed to load default recipes:", error);
    }
  }

  /**
   * Register a recipe
   */
  registerRecipe(recipe: FixRecipe): void {
    this.recipes.set(recipe.id, recipe);

    // Index by issue type
    const issueType = recipe.match.issueType;
    if (!this.recipesByType.has(issueType)) {
      this.recipesByType.set(issueType, []);
    }
    this.recipesByType.get(issueType)!.push(recipe);

    logger.debug(`Registered recipe: ${recipe.id} for ${issueType}`);
  }

  /**
   * Find recipes matching an issue
   */
  findByIssue(issue: Issue): FixRecipe[] {
    const matchingRecipes: FixRecipe[] = [];

    // Get recipes for this issue type
    const recipesForType = this.recipesByType.get(issue.type) || [];

    for (const recipe of recipesForType) {
      if (this.matchesConditions(issue, recipe)) {
        matchingRecipes.push(recipe);
      }
    }

    return matchingRecipes;
  }

  /**
   * Check if issue matches recipe conditions
   */
  private matchesConditions(issue: Issue, recipe: FixRecipe): boolean {
    // Basic type match
    if (recipe.match.issueType !== issue.type) {
      return false;
    }

    // Check additional conditions if specified
    if (recipe.match.conditions) {
      for (const [key, value] of Object.entries(recipe.match.conditions)) {
        if (issue.context[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Sort recipes by risk (low to high)
   */
  sortByRisk(recipes: FixRecipe[]): FixRecipe[] {
    return [...recipes].sort((a, b) => a.risk.score - b.risk.score);
  }

  /**
   * Resolve recipe dependencies
   * Ensures dependent recipes are executed in correct order
   */
  resolveDependencies(recipes: FixRecipe[]): FixRecipe[] {
    const resolved: FixRecipe[] = [];
    const resolving = new Set<string>();
    const recipeMap = new Map(recipes.map((r) => [r.id, r]));

    const resolve = (recipe: FixRecipe) => {
      if (resolved.includes(recipe)) {
        return;
      }

      if (resolving.has(recipe.id)) {
        logger.warn(`Circular dependency detected for recipe: ${recipe.id}`);
        return;
      }

      resolving.add(recipe.id);

      // Resolve dependencies first
      if (recipe.dependsOn) {
        for (const depId of recipe.dependsOn) {
          const dep = recipeMap.get(depId) || this.recipes.get(depId);
          if (dep) {
            resolve(dep);
          } else {
            logger.warn(
              `Dependency not found: ${depId} for recipe: ${recipe.id}`,
            );
          }
        }
      }

      resolving.delete(recipe.id);
      resolved.push(recipe);
    };

    for (const recipe of recipes) {
      resolve(recipe);
    }

    return resolved;
  }

  /**
   * Get recipe by ID
   */
  getRecipe(id: string): FixRecipe | undefined {
    return this.recipes.get(id);
  }

  /**
   * Get all recipes
   */
  getAllRecipes(): FixRecipe[] {
    return Array.from(this.recipes.values());
  }

  /**
   * Get recipes by issue type
   */
  getRecipesByType(issueType: string): FixRecipe[] {
    return this.recipesByType.get(issueType) || [];
  }

  /**
   * Load custom recipes from JSON
   */
  async loadCustomRecipes(recipesJson: string | FixRecipe[]): Promise<void> {
    try {
      const recipes =
        typeof recipesJson === "string" ? JSON.parse(recipesJson) : recipesJson;

      if (!Array.isArray(recipes)) {
        throw new Error("Recipes must be an array");
      }

      for (const recipe of recipes) {
        this.validateRecipe(recipe);
        this.registerRecipe(recipe);
      }

      logger.info(`Loaded ${recipes.length} custom recipes`);
    } catch (error) {
      logger.error("Failed to load custom recipes:", error);
      throw error;
    }
  }

  /**
   * Validate recipe structure
   */
  private validateRecipe(recipe: any): void {
    const required = ["id", "name", "description", "match", "risk", "actions"];

    for (const field of required) {
      if (!recipe[field]) {
        throw new Error(`Recipe missing required field: ${field}`);
      }
    }

    if (!recipe.match.issueType) {
      throw new Error("Recipe must specify match.issueType");
    }

    if (!recipe.actions.apply || !Array.isArray(recipe.actions.apply)) {
      throw new Error("Recipe must have actions.apply array");
    }

    if (
      typeof recipe.risk.score !== "number" ||
      recipe.risk.score < 0 ||
      recipe.risk.score > 1
    ) {
      throw new Error("Recipe risk.score must be between 0 and 1");
    }
  }
}
