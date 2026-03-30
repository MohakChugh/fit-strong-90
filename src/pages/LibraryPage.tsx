import { useState, useMemo } from 'react';
import { exercises, getExercisesByCategory } from '@/data/exercises';
import type { MuscleGroup, Difficulty } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Search, Dumbbell, AlertCircle, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  beginner: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  intermediate: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  advanced: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
};

const CATEGORIES: Array<{ value: MuscleGroup | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'back', label: 'Back' },
  { value: 'chest', label: 'Chest' },
  { value: 'legs', label: 'Legs' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Mobility' },
];

const DIFFICULTY_FILTERS: Array<{ value: Difficulty | 'all'; label: string }> = [
  { value: 'all', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MuscleGroup | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | 'all'>('all');

  const filteredExercises = useMemo(() => {
    let filtered = exercises;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = getExercisesByCategory(selectedCategory);
    }

    // Filter by difficulty
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(ex => ex.difficulty === selectedDifficulty);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ex =>
        ex.name.toLowerCase().includes(query) ||
        ex.primaryMuscles.some(m => m.toLowerCase().includes(query)) ||
        ex.equipment.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [searchQuery, selectedCategory, selectedDifficulty]);

  const openYouTube = (query: string) => {
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
          <Dumbbell className="h-10 w-10" />
          Exercise Library
        </h1>
        <p className="text-muted-foreground mt-2">
          {exercises.length} exercises with detailed instructions and alternatives
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search exercises by name, muscle, or equipment..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Filter */}
      <div>
        <label className="text-sm font-medium mb-2 block">Category</label>
        <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as MuscleGroup | 'all')}>
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-9 gap-1 h-auto">
            {CATEGORIES.map(cat => (
              <TabsTrigger key={cat.value} value={cat.value} className="capitalize">
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Difficulty Filter */}
      <div>
        <label className="text-sm font-medium mb-2 block">Difficulty Level</label>
        <Tabs value={selectedDifficulty} onValueChange={(v) => setSelectedDifficulty(v as Difficulty | 'all')}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1">
            {DIFFICULTY_FILTERS.map(diff => (
              <TabsTrigger key={diff.value} value={diff.value}>
                {diff.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''}
      </div>

      {/* Exercise Cards */}
      {filteredExercises.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No exercises found matching your filters. Try adjusting your search or filters.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredExercises.map((exercise) => (
            <Card key={exercise.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-xl">{exercise.name}</CardTitle>
                  <Badge
                    variant="outline"
                    className={DIFFICULTY_COLORS[exercise.difficulty]}
                  >
                    {exercise.difficulty}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2 flex-wrap">
                  {exercise.primaryMuscles.map((muscle, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {muscle}
                    </Badge>
                  ))}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Equipment</p>
                  <p className="text-sm">{exercise.equipment}</p>
                </div>

                <Accordion>
                  <AccordionItem value="details" className="border-0">
                    <AccordionTrigger className="text-sm font-medium py-2">
                      View Details
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      {/* Instructions */}
                      <div>
                        <p className="text-sm font-semibold mb-2">Instructions</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                          {exercise.instructions.map((instruction, idx) => (
                            <li key={idx}>{instruction}</li>
                          ))}
                        </ol>
                      </div>

                      {/* Common Mistakes */}
                      {exercise.commonMistakes.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                            Common Mistakes
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            {exercise.commonMistakes.map((mistake, idx) => (
                              <li key={idx}>{mistake}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Alternatives */}
                      <div className="space-y-2">
                        {exercise.beginnerAlternative && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Beginner Alternative</p>
                            <p className="text-sm">{exercise.beginnerAlternative}</p>
                          </div>
                        )}
                        {exercise.advancedAlternative && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Advanced Alternative</p>
                            <p className="text-sm">{exercise.advancedAlternative}</p>
                          </div>
                        )}
                      </div>

                      {/* YouTube Demo Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openYouTube(exercise.youtubeSearchQuery)}
                        className="w-full"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Watch Demo on YouTube
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
