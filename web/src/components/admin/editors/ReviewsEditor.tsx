'use client';

import { Plus, Trash2, Star } from 'lucide-react';

interface Review {
  id?: string;
  author: string;
  rating: number;
  text: string;
  date?: string;
}

interface ReviewsEditorProps {
  reviews: Review[];
  onReviewsChange: (_: Review[]) => void;
}

export default function ReviewsEditor({ reviews, onReviewsChange }: ReviewsEditorProps) {
  const handleAdd = () => {
    const newReview: Review = {
      author: '',
      rating: 5,
      text: '',
      date: new Date().toISOString().split('T')[0],
    };
    onReviewsChange([...reviews, newReview]);
  };

  const handleDelete = (index: number) => {
    const newReviews = reviews.filter((_, i) => i !== index);
    onReviewsChange(newReviews);
  };

  const handleChange = (index: number, field: keyof Review, value: any) => {
    const newReviews = [...reviews];
    newReviews[index] = { ...newReviews[index], [field]: value };
    onReviewsChange(newReviews);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customer Reviews</h2>
          <p className="text-sm text-gray-600 mt-1">
            Showcase testimonials and ratings
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={18} />
          Add Review
        </button>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <Star size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">No reviews added yet</p>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={18} />
            Add First Review
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review, index) => (
            <div
              key={index}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 grid grid-cols-2 gap-4">
                  {/* Author */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Author Name
                    </label>
                    <input
                      type="text"
                      value={review.author}
                      onChange={(e) => handleChange(index, 'author', e.target.value)}
                      placeholder="John Smith"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  {/* Rating */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Rating
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={review.rating}
                        onChange={(e) => handleChange(index, 'rating', parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value={5}>5 Stars</option>
                        <option value={4}>4 Stars</option>
                        <option value={3}>3 Stars</option>
                        <option value={2}>2 Stars</option>
                        <option value={1}>1 Star</option>
                      </select>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={16}
                            className={star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(index)}
                  className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded transition"
                  title="Delete review"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Review Text */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Review Text
                </label>
                <textarea
                  value={review.text}
                  onChange={(e) => handleChange(index, 'text', e.target.value)}
                  placeholder="Fantastic work from start to finish. Highly recommend for any kitchen project..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                />
              </div>

              {/* Date */}
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={review.date || ''}
                  onChange={(e) => handleChange(index, 'date', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
