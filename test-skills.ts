import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { storage } from '@/lib/storage';
import { createTodo, updateTodo, getTodos } from '@/app/actions';
import { simulateChatInteraction } from './test-utils';

describe('AI-driven TODO updates', () => {
  beforeEach(async () => {
    // Clear existing todos before each test
    const todos = await storage.getTodos();
    for (const todo of todos) {
      await storage.deleteTodo(todo.id);
    }
  });

  afterEach(async () => {
    // Clean up after each test
    const todos = await storage.getTodos();
    for (const todo of todos) {
      await storage.deleteTodo(todo.id);
    }
  });

  it('should update existing TODO when user requests modification', async () => {
    // 1. Create a test TODO
    const testTodo = await createTodo({
      title: 'Buy milk',
      description: '2% fat content',
      priority: 2,
    });

    // 2. Simulate user message requesting update
    const userMessage = `Change the priority of TODO ${testTodo.id} to 3 and add description "Organic milk"`;
    const response = await simulateChatInteraction([{ role: 'user', content: userMessage }]);

    // 3. Verify AI used updateTodo tool
    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({
        name: 'updateTodo',
        parameters: expect.objectContaining({
          id: testTodo.id,
          priority: 3,
          description: 'Organic milk'
        })
      })
    );

    // 4. Verify TODO was actually updated in storage
    const updatedTodos = await getTodos();
    const updatedTodo = updatedTodos.find(t => t.id === testTodo.id);

    expect(updatedTodo).toBeDefined();
    expect(updatedTodo?.priority).toBe(3);
    expect(updatedTodo?.description).toBe('Organic milk');
  });

  it('should handle partial updates and title matching', async () => {
    // 1. Create a test TODO
    await createTodo({
      title: 'Finish project report',
      priority: 1,
    });

    // 2. Simulate user message with partial update
    // Create a test TODO and get its ID
    const testTodo = await createTodo({
      title: 'Finish project report',
      priority: 1,
    });
    const userMessage = `Mark TODO ${testTodo.id} as completed`;
    await simulateChatInteraction([{ role: 'user', content: userMessage }]);

    // 3. Verify TODO was marked as completed
    const updatedTodos = await getTodos();
    const completedTodo = updatedTodos.find(t => t.title === 'Finish project report');

    expect(completedTodo?.completed).toBe(true);
  });
});