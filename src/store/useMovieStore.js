import { create } from "zustand";

//TMDB키를 변수로 저장하기
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const YOUTUBE_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

export const useMovieStore = create((set, get) => ({
    // ############ 영화 (인기)
    //인기영화를 저장할 배열
    popMovies: [],
    //인기영화를 불러올 메서드
    onFetchPopular: async () => {
        const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=ko-KR&page=1`)
        // console.log(res);
        const data = await res.json();
        console.log("영화", data.results);
        // console.log(data);
        set({ popMovies: data.results })
    },
    // 영화의 비디오를 저장할 변수
    popVideo: {},
    // 영화의 비디오를 불러오은 메서드 
    onFetchVideo: async (id) => {
        //기존에 불러온 영상이 있는지를 체크해서 있으면 그만 불러와야지??
        const { popVideo } = get();

        if (popVideo[id]) return;

        const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/videos?api_key=${TMDB_KEY}&language=ko-KR`)
        // console.log("비디오", res)
        const data = await res.json();
        // console.log("비디오 데이터", data)
        set((state) => ({
            popVideo: {
                ...state.popVideo,
                [id]: data.results
            }
        }))
    },

    // ############# 티비 (인기)

    // 인기 TV 목록
    tvs: [],
    // TV 영상 저장
    tvVideo: {},
    // 인기 TV 불러오기
    onFetchTv: async () => {
        const res = await fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=ko-KR&page=1`);

        if (!res.ok) throw new Error("TV 목록을 불러오지 못했습니다.");
        const data = await res.json();
        console.log("TV", data.results);
        //?? 왼쪽값이 null, undefined 이면 오른쪽을 사용해라
        //? 왼쪽값이 존재하면 체이닝을 실행해라
        set({ tvs: data.results ?? [] });
    },

    // TV 영상 가져오기
    onFetchTvVideo: async (id) => {
        const { tvVideo } = get();
        if (tvVideo[id]) return;
        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/videos?api_key=${TMDB_KEY}&language=en-US`);

        if (!res.ok) throw new Error("TV 영상을 불러오지 못했습니다.");
        const data = await res.json();
        set((state) => ({
            tvVideo: {
                ...state.tvVideo,
                [id]: data.results ?? []
            }
        }));
    },

    // ############# 시즌

    // TV ID별 상세정보 저장
    tvDetails: {},

    // TV ID별 시즌 목록 저장
    seasons: {},

    // TV 상세정보 + 시즌 목록 가져오기
    onFetchSeason: async (id) => {
        const { seasons } = get();

        // 이미 저장된 시즌이면 요청하지 않음
        if (seasons[id]) return;

        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_KEY}&language=ko-KR`);

        if (!res.ok) throw new Error("시즌 정보를 불러오지 못했습니다.");

        const data = await res.json();
        set((state) => ({
            tvDetails: {
                ...state.tvDetails,
                [id]: data
            },
            seasons: {
                ...state.seasons,
                [id]: data.seasons ?? []
            }
        }));
    },

    // ############# 에피소드

    // TV ID와 시즌 번호별 에피소드 저장
    episodes: {},
    // 특정 시즌의 에피소드 가져오기
    onFetchEpisode: async (id, season) => {
        const { episodes } = get();

        // 동일한 TV라도 시즌마다 다른 에피소드
        const key = `${id}-${season}`;
        // 이미 저장된 에피소드면 요청하지 않음
        if (episodes[key]) return;
        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_KEY}&language=ko-KR`);

        if (!res.ok) throw new Error("에피소드를 불러오지 못했습니다.");

        const data = await res.json();
        set((state) => ({
            episodes: {
                ...state.episodes,
                [key]: data.episodes ?? []
            }
        }));
    },

    // ############# 에피소드 영상

    // "TV ID-시즌-에피소드" 별 영상 저장
    episodeVideo: {},

    // 특정 에피소드의 영상 가져오기
    onFetchEpisodeVideo: async (id, season, episode) => {
    const { episodeVideo, tvDetails, tvs, episodes } = get();

    const key = `${id}-${season}-${episode}`;
    if (episodeVideo[key]) return;

    let videos = [];

    // 1. TMDB에서 에피소드 영상 검색
    try {
        const res = await fetch(
            `https://api.themoviedb.org/3/tv/${id}/season/${season}/episode/${episode}/videos?api_key=${TMDB_KEY}&language=en-US`
        );

        if (!res.ok) {
            throw new Error("에피소드 영상을 불러오지 못했습니다.");
        }

        const data = await res.json();
        videos = (data.results ?? []).filter(
            (v) => v.site === "YouTube" && v.key
        );
    } catch (error) {
        console.error("TMDB 영상 검색 실패:", error);
    }

    // 2. TMDB 영상이 없으면 YouTube API 검색
    if (videos.length === 0 && YOUTUBE_KEY) {
        try {
            // TV 프로그램 제목 가져오기
            const tv = tvDetails[id] || tvs.find((t) => t.id === id);
            const tvName = tv?.name || tv?.original_name;

            // 에피소드 제목 가져오기
            const episodeList = episodes[`${id}-${season}`] || [];
            const episodeInfo = episodeList.find(
                (e) => e.episode_number === episode
            );

            if (tvName) {
                const searchText =
                    `${tvName} 시즌 ${season} ${episode}화 ${episodeInfo?.name || ""} 하이라이트`;

                const params = new URLSearchParams({
                    part: "snippet",
                    q: searchText,
                    type: "video",
                    maxResults: "5",
                    videoEmbeddable: "true",
                    key: YOUTUBE_KEY
                });

                const youtubeRes = await fetch(
                    `https://www.googleapis.com/youtube/v3/search?${params}`
                );

                if (!youtubeRes.ok) {
                    throw new Error("YouTube 영상 검색 실패");
                }

                const youtubeData = await youtubeRes.json();

                videos = (youtubeData.items ?? [])
                    .filter((item) => item.id?.videoId)
                    .map((item) => ({
                        key: item.id.videoId,
                        name: item.snippet.title,
                        site: "YouTube",
                        type: "Clip"
                    }));
            }
        } catch (error) {
            console.error("YouTube 검색 실패:", error);
        }
    }

    // 3. Zustand에 영상 저장
    set((state) => ({
        episodeVideo: {
            ...state.episodeVideo,
            [key]: videos
        }
    }));
}
}));