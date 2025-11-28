import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function SupabaseTest() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const testConnection = async () => {
    setStatus('testing');
    setMessage('Test de connexion en cours...');

    try {
      // Test de connexion simple
      const { data, error } = await supabase
        .from('professors')
        .select('count')
        .limit(1);

      if (error) {
        throw error;
      }

      setStatus('success');
      setMessage('✅ Connexion à Supabase réussie !');
    } catch (error: any) {
      setStatus('error');
      setMessage(`❌ Erreur de connexion: ${error.message}`);
      console.error('Erreur Supabase:', error);
    }
  };

  const createTestData = async () => {
    setStatus('testing');
    setMessage('Création de données de test...');

    try {
      // Créer un professeur de test
      const { data, error } = await supabase
        .from('professors')
        .insert({
          academic_title: 'Dr.',
          specialization: 'Informatique',
          weekly_hours: 20,
          email: 'test@example.com'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setStatus('success');
      setMessage(`✅ Professeur de test créé avec l'ID: ${data.id}`);
    } catch (error: any) {
      setStatus('error');
      setMessage(`❌ Erreur lors de la création: ${error.message}`);
      console.error('Erreur création:', error);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Test de Connexion Supabase</h2>
      
      <div className="space-y-4">
        <div className="flex space-x-4">
          <button
            onClick={testConnection}
            disabled={status === 'testing'}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Tester la Connexion
          </button>
          
          <button
            onClick={createTestData}
            disabled={status === 'testing'}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Créer Données de Test
          </button>
        </div>

        <div className={`p-4 rounded ${
          status === 'success' ? 'bg-green-50 text-green-800' :
          status === 'error' ? 'bg-red-50 text-red-800' :
          status === 'testing' ? 'bg-yellow-50 text-yellow-800' :
          'bg-gray-50 text-gray-800'
        }`}>
          {message || 'Cliquez sur un bouton pour tester Supabase'}
        </div>

        <div className="text-sm text-gray-600">
          <p><strong>URL:</strong> {supabase.supabaseUrl}</p>
          <p><strong>Status:</strong> {status}</p>
        </div>
      </div>
    </div>
  );
}
