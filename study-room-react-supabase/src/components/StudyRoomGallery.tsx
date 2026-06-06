import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface GalleryImage {
  id: number;
  src: string;
  alt: string;
  title: string;
}

export default function StudyRoomGallery() {
  const images: GalleryImage[] = [
    {
      id: 1,
      src: '/images/study-room-1.jpg',
      alt: 'Main conference room with organized study stations',
      title: 'Conference Area',
    },
    {
      id: 2,
      src: '/images/study-room-2.jpg',
      alt: 'Individual study cubicles with partition setup',
      title: 'Study Cubicles',
    },
    {
      id: 3,
      src: '/images/study-room-3.jpg',
      alt: 'Spacious study floor with comfortable seating',
      title: 'Study Floor',
    },
    {
      id: 4,
      src: '/images/study-room-4.jpg',
      alt: 'Students actively learning in study stations',
      title: 'Active Learning Space',
    },
  ];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const goToPrevious = () => {
    setCurrentImageIndex((prevIndex) =>
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentImageIndex((prevIndex) =>
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
  };

  const goToImage = (index: number) => {
    setCurrentImageIndex(index);
  };

  const currentImage = images[currentImageIndex];

  return (
    <div className="sr-card">
      <div className="sr-card-header">
        <h2 className="sr-card-title">Study Room Gallery</h2>
      </div>

      <div className="sr-card-content">
        {/* Main Image Carousel */}
        <div className="relative overflow-hidden rounded-lg bg-gray-100">
          <div className="relative aspect-video w-full">
            <img
              src={currentImage.src}
              alt={currentImage.alt}
              className="h-full w-full object-cover transition-opacity duration-500"
            />

            {/* Navigation Buttons */}
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-all hover:bg-black/70"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-all hover:bg-black/70"
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>

            {/* Image Counter */}
            <div className="absolute bottom-4 right-4 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
              {currentImageIndex + 1} / {images.length}
            </div>
          </div>
        </div>

        {/* Image Title and Description */}
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {currentImage.title}
          </h3>
          <p className="mt-1 text-sm text-gray-600">{currentImage.alt}</p>
        </div>

        {/* Thumbnail Navigation */}
        <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => goToImage(index)}
              className={`relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-lg transition-all ${
                index === currentImageIndex
                  ? 'ring-2 ring-blue-500'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={image.src}
                alt={image.alt}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-6 rounded-lg bg-blue-50 p-4">
          <p className="text-sm text-gray-700">
            Our state-of-the-art study facilities provide a conducive learning
            environment with modern infrastructure, comfortable seating, and
            organized study spaces designed for maximum productivity.
          </p>
        </div>
      </div>
    </div>
  );
}
