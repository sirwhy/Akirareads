import React from 'react';
import { Link } from 'react-router-dom';
import { FiEye, FiList } from 'react-icons/fi';


const STATUS_COLOR = { ONGOING: 'text-green-400 bg-green-400/10', COMPLETED: 'text-blue-400 bg-blue-400/10', HIATUS: 'text-yellow-400 bg-yellow-400/10', DROPPED: 'text-red-400 bg-red-400/10' };
const STATUS_LABEL = { ONGOING: 'Ongoing', COMPLETED: 'Tamat', HIATUS: 'Hiatus', DROPPED: 'Drop' };

export default function SeriesCard({ series }) {
  return (
    <Link to={`/series/${series.slug}`} className="series-card card group block">
      <div className="relative aspect-[3/4] overflow-hidden">
        {series.cover ? (
          <img src={series.cover} alt={series.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-dark-600 flex items-center justify-center">
            <span className="text-3xl opacity-20">📖</span>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-transparent to-transparent" />
        {/* Hover overlay */}
        <div className="series-overlay absolute inset-0 bg-accent/10 flex items-center justify-center">
          <span className="bg-accent text-white text-xs font-semibold px-3 py-1 rounded-full">Baca Sekarang</span>
        </div>
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <span className={`badge text-[10px] ${STATUS_COLOR[series.status] || 'text-white/60 bg-white/10'}`}>
            {STATUS_LABEL[series.status] || series.status}
          </span>
          {series.featured && <span className="badge text-[10px] text-yellow-400 bg-yellow-400/10">Featured</span>}
        </div>
        {/* Chapter count */}
        {series._count && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white/70 text-[10px] px-2 py-1 rounded-full">
            <FiList className="text-[10px]" />
            <span>{series._count.chapters} ch</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-accent transition-colors leading-snug">{series.title}</h3>
        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/40">
          <span>{series.type}</span>
          {series.views > 0 && <>
            <span>·</span>
            <span className="flex items-center gap-0.5"><FiEye className="text-[10px]" /> {series.views > 1000 ? `${(series.views/1000).toFixed(1)}k` : series.views}</span>
          </>}
        </div>
      </div>
    </Link>
  );
}
