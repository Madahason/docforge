export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      brand_configs: {
        Row: {
          id: string;
          user_id: string;
          primary_color: string;
          secondary_color: string;
          background_color: string;
          text_color: string;
          muted_color: string;
          font_family: string;
          logo_url: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          primary_color?: string;
          secondary_color?: string;
          background_color?: string;
          text_color?: string;
          muted_color?: string;
          font_family?: string;
          logo_url?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          primary_color?: string;
          secondary_color?: string;
          background_color?: string;
          text_color?: string;
          muted_color?: string;
          font_family?: string;
          logo_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      captions: {
        Row: {
          caption_lines: Json;
          created_at: string;
          custom_styles: Json | null;
          id: string;
          project_id: string;
          scene_id: string;
          srt_content: string | null;
          status: string;
          style_preset: string;
          updated_at: string;
          user_id: string;
          voiceover_id: string | null;
          vtt_content: string | null;
          words: Json;
        };
        Insert: {
          caption_lines?: Json;
          created_at?: string;
          custom_styles?: Json | null;
          id?: string;
          project_id: string;
          scene_id: string;
          srt_content?: string | null;
          status?: string;
          style_preset?: string;
          updated_at?: string;
          user_id: string;
          voiceover_id?: string | null;
          vtt_content?: string | null;
          words?: Json;
        };
        Update: {
          caption_lines?: Json;
          created_at?: string;
          custom_styles?: Json | null;
          id?: string;
          project_id?: string;
          scene_id?: string;
          srt_content?: string | null;
          status?: string;
          style_preset?: string;
          updated_at?: string;
          user_id?: string;
          voiceover_id?: string | null;
          vtt_content?: string | null;
          words?: Json;
        };
        Relationships: [];
      };
      client_comments: {
        Row: {
          comment_text: string;
          comment_type: string;
          created_at: string;
          id: string;
          project_id: string;
          review_id: string;
          scene_id: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          comment_text: string;
          comment_type?: string;
          created_at?: string;
          id?: string;
          project_id: string;
          review_id: string;
          scene_id?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          comment_text?: string;
          comment_type?: string;
          created_at?: string;
          id?: string;
          project_id?: string;
          review_id?: string;
          scene_id?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      client_reviews: {
        Row: {
          client_email: string | null;
          client_name: string | null;
          created_at: string;
          id: string;
          overall_comment: string | null;
          project_id: string;
          responded_at: string | null;
          share_token: string;
          status: string;
          updated_at: string;
          user_id: string;
          viewed_at: string | null;
        };
        Insert: {
          client_email?: string | null;
          client_name?: string | null;
          created_at?: string;
          id?: string;
          overall_comment?: string | null;
          project_id: string;
          responded_at?: string | null;
          share_token: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          viewed_at?: string | null;
        };
        Update: {
          client_email?: string | null;
          client_name?: string | null;
          created_at?: string;
          id?: string;
          overall_comment?: string | null;
          project_id?: string;
          responded_at?: string | null;
          share_token?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          viewed_at?: string | null;
        };
        Relationships: [];
      };
      clip_index: {
        Row: {
          color_temperature: string | null;
          content_tags: Json;
          created_at: string;
          duration_seconds: number | null;
          id: string;
          mood_tags: Json;
          quality_score: number;
          rights_risk: string;
          source_channel: string | null;
          source_title: string | null;
          source_url: string | null;
          source_video_id: string | null;
          thumbnail_url: string | null;
          timestamp_end: string | null;
          timestamp_start: string | null;
          usage_count: number;
          user_id: string;
          verified: boolean;
          visual_job: string | null;
        };
        Insert: {
          color_temperature?: string | null;
          content_tags?: Json;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          mood_tags?: Json;
          quality_score?: number;
          rights_risk?: string;
          source_channel?: string | null;
          source_title?: string | null;
          source_url?: string | null;
          source_video_id?: string | null;
          thumbnail_url?: string | null;
          timestamp_end?: string | null;
          timestamp_start?: string | null;
          usage_count?: number;
          user_id: string;
          verified?: boolean;
          visual_job?: string | null;
        };
        Update: {
          color_temperature?: string | null;
          content_tags?: Json;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          mood_tags?: Json;
          quality_score?: number;
          rights_risk?: string;
          source_channel?: string | null;
          source_title?: string | null;
          source_url?: string | null;
          source_video_id?: string | null;
          thumbnail_url?: string | null;
          timestamp_end?: string | null;
          timestamp_start?: string | null;
          usage_count?: number;
          user_id?: string;
          verified?: boolean;
          visual_job?: string | null;
        };
        Relationships: [];
      };
      clips: {
        Row: {
          animation_type: string | null;
          animation_url: string | null;
          asset_type: string;
          clip_status: string;
          color_temperature: string | null;
          content_tags: Json;
          created_at: string;
          duration_seconds: number | null;
          fetch_status: string;
          has_overlay: boolean;
          hera_mode: string;
          id: string;
          image_url: string | null;
          ken_burns_config: Json | null;
          local_file_path: string | null;
          mood_tags: Json;
          notes: string | null;
          overlay_config: Json | null;
          project_id: string;
          quality_score: number;
          resolution: string | null;
          rights_risk: string;
          scene_id: string;
          source_channel: string | null;
          source_title: string | null;
          source_type: string | null;
          source_url: string | null;
          source_video_id: string | null;
          status: string;
          thumbnail_url: string | null;
          timestamp_end: string | null;
          timestamp_start: string | null;
          updated_at: string;
          usage_count: number;
          user_id: string;
          verified: boolean;
          visual_job: string | null;
        };
        Insert: {
          animation_type?: string | null;
          animation_url?: string | null;
          asset_type?: string;
          clip_status?: string;
          color_temperature?: string | null;
          content_tags?: Json;
          created_at?: string;
          duration_seconds?: number | null;
          fetch_status?: string;
          has_overlay?: boolean;
          hera_mode?: string;
          id?: string;
          image_url?: string | null;
          ken_burns_config?: Json | null;
          local_file_path?: string | null;
          mood_tags?: Json;
          notes?: string | null;
          overlay_config?: Json | null;
          project_id: string;
          quality_score?: number;
          resolution?: string | null;
          rights_risk?: string;
          scene_id: string;
          source_channel?: string | null;
          source_title?: string | null;
          source_type?: string | null;
          source_url?: string | null;
          source_video_id?: string | null;
          status?: string;
          thumbnail_url?: string | null;
          timestamp_end?: string | null;
          timestamp_start?: string | null;
          updated_at?: string;
          usage_count?: number;
          user_id: string;
          verified?: boolean;
          visual_job?: string | null;
        };
        Update: {
          animation_type?: string | null;
          animation_url?: string | null;
          asset_type?: string;
          clip_status?: string;
          color_temperature?: string | null;
          content_tags?: Json;
          created_at?: string;
          duration_seconds?: number | null;
          fetch_status?: string;
          has_overlay?: boolean;
          hera_mode?: string;
          id?: string;
          image_url?: string | null;
          ken_burns_config?: Json | null;
          local_file_path?: string | null;
          mood_tags?: Json;
          notes?: string | null;
          overlay_config?: Json | null;
          project_id?: string;
          quality_score?: number;
          resolution?: string | null;
          rights_risk?: string;
          scene_id?: string;
          source_channel?: string | null;
          source_title?: string | null;
          source_type?: string | null;
          source_url?: string | null;
          source_video_id?: string | null;
          status?: string;
          thumbnail_url?: string | null;
          timestamp_end?: string | null;
          timestamp_start?: string | null;
          updated_at?: string;
          usage_count?: number;
          user_id?: string;
          verified?: boolean;
          visual_job?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clips_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clips_scene_id_fkey";
            columns: ["scene_id"];
            isOneToOne: false;
            referencedRelation: "scenes";
            referencedColumns: ["id"];
          },
        ];
      };
      error_logs: {
        Row: {
          component: string | null;
          created_at: string;
          error_message: string | null;
          error_stack: string | null;
          id: string;
          page_url: string | null;
          user_id: string | null;
        };
        Insert: {
          component?: string | null;
          created_at?: string;
          error_message?: string | null;
          error_stack?: string | null;
          id?: string;
          page_url?: string | null;
          user_id?: string | null;
        };
        Update: {
          component?: string | null;
          created_at?: string;
          error_message?: string | null;
          error_stack?: string | null;
          id?: string;
          page_url?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          created_at: string;
          feedback_text: string;
          feedback_type: string;
          id: string;
          page_url: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          feedback_text: string;
          feedback_type: string;
          id?: string;
          page_url?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          feedback_text?: string;
          feedback_type?: string;
          id?: string;
          page_url?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      hera_cache: {
        Row: {
          camera_motion: string | null;
          color_temperature: string | null;
          content_tags: Json;
          created_at: string;
          created_by: string;
          duration_seconds: number;
          editing_style: string | null;
          emotional_temperature: string | null;
          graphic_type: string | null;
          hera_mode: string;
          id: string;
          is_shared: boolean;
          last_used_at: string | null;
          match_keywords: Json;
          mood_tags: Json;
          output_url: string;
          overlay_style: string | null;
          projects_used_in: Json;
          prompt_hash: string;
          prompt_text: string;
          regeneration_count: number;
          resolution: string;
          style_profile_name: string | null;
          subject: string | null;
          thumbnail_url: string | null;
          updated_at: string;
          usage_count: number;
          user_rating: number | null;
          visual_job: string | null;
        };
        Insert: {
          camera_motion?: string | null;
          color_temperature?: string | null;
          content_tags?: Json;
          created_at?: string;
          created_by: string;
          duration_seconds?: number;
          editing_style?: string | null;
          emotional_temperature?: string | null;
          graphic_type?: string | null;
          hera_mode?: string;
          id?: string;
          is_shared?: boolean;
          last_used_at?: string | null;
          match_keywords?: Json;
          mood_tags?: Json;
          output_url: string;
          overlay_style?: string | null;
          projects_used_in?: Json;
          prompt_hash: string;
          prompt_text: string;
          regeneration_count?: number;
          resolution?: string;
          style_profile_name?: string | null;
          subject?: string | null;
          thumbnail_url?: string | null;
          updated_at?: string;
          usage_count?: number;
          user_rating?: number | null;
          visual_job?: string | null;
        };
        Update: {
          camera_motion?: string | null;
          color_temperature?: string | null;
          content_tags?: Json;
          created_at?: string;
          created_by?: string;
          duration_seconds?: number;
          editing_style?: string | null;
          emotional_temperature?: string | null;
          graphic_type?: string | null;
          hera_mode?: string;
          id?: string;
          is_shared?: boolean;
          last_used_at?: string | null;
          match_keywords?: Json;
          mood_tags?: Json;
          output_url?: string;
          overlay_style?: string | null;
          projects_used_in?: Json;
          prompt_hash?: string;
          prompt_text?: string;
          regeneration_count?: number;
          resolution?: string;
          style_profile_name?: string | null;
          subject?: string | null;
          thumbnail_url?: string | null;
          updated_at?: string;
          usage_count?: number;
          user_rating?: number | null;
          visual_job?: string | null;
        };
        Relationships: [];
      };
      image_assets: {
        Row: {
          animation_type: string | null;
          animation_url: string | null;
          created_at: string;
          id: string;
          image_urls: Json;
          ken_burns_config: Json | null;
          project_id: string;
          prompt_used: string | null;
          scene_id: string;
          selected_url: string | null;
          source_type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          animation_type?: string | null;
          animation_url?: string | null;
          created_at?: string;
          id?: string;
          image_urls?: Json;
          ken_burns_config?: Json | null;
          project_id: string;
          prompt_used?: string | null;
          scene_id: string;
          selected_url?: string | null;
          source_type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          animation_type?: string | null;
          animation_url?: string | null;
          created_at?: string;
          id?: string;
          image_urls?: Json;
          ken_burns_config?: Json | null;
          project_id?: string;
          prompt_used?: string | null;
          scene_id?: string;
          selected_url?: string | null;
          source_type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      manifests: {
        Row: {
          ai_image_scenes: number | null;
          caption_scenes: number | null;
          created_at: string;
          graphic_scenes: number | null;
          hera_scenes: number | null;
          id: string;
          is_current: boolean;
          manifest_data: Json;
          motion_graphic_scenes: number | null;
          project_id: string;
          real_footage_seconds: number | null;
          sound_design_included: boolean;
          status: string;
          stock_scenes: number | null;
          total_duration_seconds: number | null;
          total_scenes: number | null;
          updated_at: string;
          user_id: string;
          version: number;
          youtube_scenes: number | null;
        };
        Insert: {
          ai_image_scenes?: number | null;
          caption_scenes?: number | null;
          created_at?: string;
          graphic_scenes?: number | null;
          hera_scenes?: number | null;
          id?: string;
          is_current?: boolean;
          manifest_data: Json;
          motion_graphic_scenes?: number | null;
          project_id: string;
          real_footage_seconds?: number | null;
          sound_design_included?: boolean;
          status?: string;
          stock_scenes?: number | null;
          total_duration_seconds?: number | null;
          total_scenes?: number | null;
          updated_at?: string;
          user_id: string;
          version?: number;
          youtube_scenes?: number | null;
        };
        Update: {
          ai_image_scenes?: number | null;
          caption_scenes?: number | null;
          created_at?: string;
          graphic_scenes?: number | null;
          hera_scenes?: number | null;
          id?: string;
          is_current?: boolean;
          manifest_data?: Json;
          motion_graphic_scenes?: number | null;
          project_id?: string;
          real_footage_seconds?: number | null;
          sound_design_included?: boolean;
          status?: string;
          stock_scenes?: number | null;
          total_duration_seconds?: number | null;
          total_scenes?: number | null;
          updated_at?: string;
          user_id?: string;
          version?: number;
          youtube_scenes?: number | null;
        };
        Relationships: [];
      };
      motion_graphics: {
        Row: {
          confirmed: boolean;
          created_at: string;
          graphic_data: Json;
          graphic_type: string;
          hera_cache_id: string | null;
          hera_mode: string;
          hera_output_url: string | null;
          hera_project_url: string | null;
          hera_prompt_used: string | null;
          hera_video_id: string | null;
          id: string;
          overlay_base_asset_id: string | null;
          overlay_dim_base: boolean;
          overlay_dim_opacity: number;
          overlay_position: string | null;
          overlay_style: string | null;
          overlay_timing: Json | null;
          project_id: string;
          remotion_output_url: string | null;
          remotion_render_job_id: string | null;
          render_method: string;
          scene_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          confirmed?: boolean;
          created_at?: string;
          graphic_data?: Json;
          graphic_type: string;
          hera_cache_id?: string | null;
          hera_mode?: string;
          hera_output_url?: string | null;
          hera_project_url?: string | null;
          hera_prompt_used?: string | null;
          hera_video_id?: string | null;
          id?: string;
          overlay_base_asset_id?: string | null;
          overlay_dim_base?: boolean;
          overlay_dim_opacity?: number;
          overlay_position?: string | null;
          overlay_style?: string | null;
          overlay_timing?: Json | null;
          project_id: string;
          remotion_output_url?: string | null;
          remotion_render_job_id?: string | null;
          render_method?: string;
          scene_id: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          confirmed?: boolean;
          created_at?: string;
          graphic_data?: Json;
          graphic_type?: string;
          hera_cache_id?: string | null;
          hera_mode?: string;
          hera_output_url?: string | null;
          hera_project_url?: string | null;
          hera_prompt_used?: string | null;
          hera_video_id?: string | null;
          id?: string;
          overlay_base_asset_id?: string | null;
          overlay_dim_base?: boolean;
          overlay_dim_opacity?: number;
          overlay_position?: string | null;
          overlay_style?: string | null;
          overlay_timing?: Json | null;
          project_id?: string;
          remotion_output_url?: string | null;
          remotion_render_job_id?: string | null;
          render_method?: string;
          scene_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "motion_graphics_overlay_base_asset_id_fkey";
            columns: ["overlay_base_asset_id"];
            isOneToOne: false;
            referencedRelation: "clips";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          monthly_renders: number;
          monthly_voiceover_seconds: number;
          onboarding_complete: boolean;
          plan_tier: string;
          projects_count: number;
          subscription_tier: string;
          updated_at: string;
          walkthrough_complete: boolean;
          walkthrough_step: number;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          monthly_renders?: number;
          monthly_voiceover_seconds?: number;
          onboarding_complete?: boolean;
          plan_tier?: string;
          projects_count?: number;
          subscription_tier?: string;
          updated_at?: string;
          walkthrough_complete?: boolean;
          walkthrough_step?: number;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          monthly_renders?: number;
          monthly_voiceover_seconds?: number;
          onboarding_complete?: boolean;
          plan_tier?: string;
          projects_count?: number;
          subscription_tier?: string;
          updated_at?: string;
          walkthrough_complete?: boolean;
          walkthrough_step?: number;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          auto_generate_visuals: boolean;
          auto_generation_complete: boolean;
          clip_source: string;
          completion_percent: number;
          content_type: string | null;
          created_at: string;
          elevenlabs_voice_id: string | null;
          elevenlabs_voice_name: string | null;
          id: string;
          music_intensity: string | null;
          music_on: boolean;
          opening_structure: string | null;
          pacing_intensity: number | null;
          platform_targets: Json;
          script_parsed: Json | null;
          script_raw: string | null;
          status: string;
          style_profile_id: string | null;
          target_duration: string | null;
          text_overlay_frequency: string | null;
          thumbnail_url: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auto_generate_visuals?: boolean;
          auto_generation_complete?: boolean;
          clip_source?: string;
          completion_percent?: number;
          content_type?: string | null;
          created_at?: string;
          elevenlabs_voice_id?: string | null;
          elevenlabs_voice_name?: string | null;
          id?: string;
          music_intensity?: string | null;
          music_on?: boolean;
          opening_structure?: string | null;
          pacing_intensity?: number | null;
          platform_targets?: Json;
          script_parsed?: Json | null;
          script_raw?: string | null;
          status?: string;
          style_profile_id?: string | null;
          target_duration?: string | null;
          text_overlay_frequency?: string | null;
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auto_generate_visuals?: boolean;
          auto_generation_complete?: boolean;
          clip_source?: string;
          completion_percent?: number;
          content_type?: string | null;
          created_at?: string;
          elevenlabs_voice_id?: string | null;
          elevenlabs_voice_name?: string | null;
          id?: string;
          music_intensity?: string | null;
          music_on?: boolean;
          opening_structure?: string | null;
          pacing_intensity?: number | null;
          platform_targets?: Json;
          script_parsed?: Json | null;
          script_raw?: string | null;
          status?: string;
          style_profile_id?: string | null;
          target_duration?: string | null;
          text_overlay_frequency?: string | null;
          thumbnail_url?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_style_profile_id_fkey";
            columns: ["style_profile_id"];
            isOneToOne: false;
            referencedRelation: "style_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      render_jobs: {
        Row: {
          brand_config: Json | null;
          completed_at: string | null;
          created_at: string;
          duration_seconds: number;
          error_message: string | null;
          graphic_data: Json;
          graphic_type: string | null;
          id: string;
          motion_graphic_id: string | null;
          output_url: string | null;
          progress_percent: number;
          project_id: string;
          render_duration_ms: number | null;
          render_method: string;
          render_type: string | null;
          scene_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          brand_config?: Json | null;
          completed_at?: string | null;
          created_at?: string;
          duration_seconds?: number;
          error_message?: string | null;
          graphic_data?: Json;
          graphic_type?: string | null;
          id?: string;
          motion_graphic_id?: string | null;
          output_url?: string | null;
          progress_percent?: number;
          project_id: string;
          render_duration_ms?: number | null;
          render_method?: string;
          render_type?: string | null;
          scene_id: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          brand_config?: Json | null;
          completed_at?: string | null;
          created_at?: string;
          duration_seconds?: number;
          error_message?: string | null;
          graphic_data?: Json;
          graphic_type?: string | null;
          id?: string;
          motion_graphic_id?: string | null;
          output_url?: string | null;
          progress_percent?: number;
          project_id?: string;
          render_duration_ms?: number | null;
          render_method?: string;
          render_type?: string | null;
          scene_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      scene_graphics: {
        Row: {
          animation_style: string | null;
          confirmed: boolean;
          created_at: string;
          duration_seconds: number;
          graphic_category: string;
          graphic_data: Json;
          graphic_type: string | null;
          hera_output_url: string | null;
          id: string;
          overlay_style: string | null;
          overlay_text: string | null;
          position: string | null;
          project_id: string;
          render_method: string;
          scene_id: string;
          start_seconds: number;
          text_color: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          animation_style?: string | null;
          confirmed?: boolean;
          created_at?: string;
          duration_seconds?: number;
          graphic_category: string;
          graphic_data?: Json;
          graphic_type?: string | null;
          hera_output_url?: string | null;
          id?: string;
          overlay_style?: string | null;
          overlay_text?: string | null;
          position?: string | null;
          project_id: string;
          render_method?: string;
          scene_id: string;
          start_seconds?: number;
          text_color?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          animation_style?: string | null;
          confirmed?: boolean;
          created_at?: string;
          duration_seconds?: number;
          graphic_category?: string;
          graphic_data?: Json;
          graphic_type?: string | null;
          hera_output_url?: string | null;
          id?: string;
          overlay_style?: string | null;
          overlay_text?: string | null;
          position?: string | null;
          project_id?: string;
          render_method?: string;
          scene_id?: string;
          start_seconds?: number;
          text_color?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      scene_sounds: {
        Row: {
          ambient_description: string | null;
          ambient_enabled: boolean;
          ambient_file_url: string | null;
          ambient_search_terms: Json;
          ambient_status: string;
          ambient_timing: string;
          ambient_volume: number;
          confirmed: boolean;
          created_at: string;
          ducking_curve: Json;
          id: string;
          impact_at_seconds: number | null;
          impact_sound_url: string | null;
          narrative_ambient_volume: number | null;
          narrative_tension_volume: number | null;
          project_id: string;
          punctuation_description: string | null;
          punctuation_enabled: boolean;
          punctuation_file_url: string | null;
          punctuation_needed: boolean;
          punctuation_status: string;
          punctuation_timestamp: number | null;
          punctuation_trigger: string | null;
          punctuation_volume: number;
          scene_id: string;
          silence_scene: boolean;
          silence_start_offset: number | null;
          sound_reasoning: string | null;
          sync_points: Json;
          transition_description: string | null;
          transition_enabled: boolean;
          transition_file_url: string | null;
          transition_starts_before_end_seconds: number;
          transition_status: string;
          transition_type: string | null;
          transition_volume: number;
          updated_at: string;
          user_id: string;
          volume_curves: Json;
        };
        Insert: {
          ambient_description?: string | null;
          ambient_enabled?: boolean;
          ambient_file_url?: string | null;
          ambient_search_terms?: Json;
          ambient_status?: string;
          ambient_timing?: string;
          ambient_volume?: number;
          confirmed?: boolean;
          created_at?: string;
          ducking_curve?: Json;
          id?: string;
          impact_at_seconds?: number | null;
          impact_sound_url?: string | null;
          narrative_ambient_volume?: number | null;
          narrative_tension_volume?: number | null;
          project_id: string;
          punctuation_description?: string | null;
          punctuation_enabled?: boolean;
          punctuation_file_url?: string | null;
          punctuation_needed?: boolean;
          punctuation_status?: string;
          punctuation_timestamp?: number | null;
          punctuation_trigger?: string | null;
          punctuation_volume?: number;
          scene_id: string;
          silence_scene?: boolean;
          silence_start_offset?: number | null;
          sound_reasoning?: string | null;
          sync_points?: Json;
          transition_description?: string | null;
          transition_enabled?: boolean;
          transition_file_url?: string | null;
          transition_starts_before_end_seconds?: number;
          transition_status?: string;
          transition_type?: string | null;
          transition_volume?: number;
          updated_at?: string;
          user_id: string;
          volume_curves?: Json;
        };
        Update: {
          ambient_description?: string | null;
          ambient_enabled?: boolean;
          ambient_file_url?: string | null;
          ambient_search_terms?: Json;
          ambient_status?: string;
          ambient_timing?: string;
          ambient_volume?: number;
          confirmed?: boolean;
          created_at?: string;
          ducking_curve?: Json;
          id?: string;
          impact_at_seconds?: number | null;
          impact_sound_url?: string | null;
          narrative_ambient_volume?: number | null;
          narrative_tension_volume?: number | null;
          project_id?: string;
          punctuation_description?: string | null;
          punctuation_enabled?: boolean;
          punctuation_file_url?: string | null;
          punctuation_needed?: boolean;
          punctuation_status?: string;
          punctuation_timestamp?: number | null;
          punctuation_trigger?: string | null;
          punctuation_volume?: number;
          scene_id?: string;
          silence_scene?: boolean;
          silence_start_offset?: number | null;
          sound_reasoning?: string | null;
          sync_points?: Json;
          transition_description?: string | null;
          transition_enabled?: boolean;
          transition_file_url?: string | null;
          transition_starts_before_end_seconds?: number;
          transition_status?: string;
          transition_type?: string | null;
          transition_volume?: number;
          updated_at?: string;
          user_id?: string;
          volume_curves?: Json;
        };
        Relationships: [];
      };
      scenes: {
        Row: {
          captions_status: string;
          clip_brief: Json | null;
          clip_status: string;
          created_at: string;
          data_graphic_detail: string | null;
          data_graphic_flag: boolean;
          emotional_temperature: string | null;
          estimated_seconds: number | null;
          graphics_status: string;
          id: string;
          is_real_footage_scene: boolean;
          motion_graphic_data: Json | null;
          motion_graphic_type: string | null;
          pacing_instruction: string | null;
          project_id: string;
          recommended_asset_type: string;
          scene_index: number;
          script_text: string;
          sound_status: string;
          text_overlay_flag: boolean;
          text_overlay_suggestion: string | null;
          updated_at: string;
          user_id: string;
          visual_job: string | null;
          word_count: number | null;
          youtube_source_priority: Json;
        };
        Insert: {
          captions_status?: string;
          clip_brief?: Json | null;
          clip_status?: string;
          created_at?: string;
          data_graphic_detail?: string | null;
          data_graphic_flag?: boolean;
          emotional_temperature?: string | null;
          estimated_seconds?: number | null;
          graphics_status?: string;
          id?: string;
          is_real_footage_scene?: boolean;
          motion_graphic_data?: Json | null;
          motion_graphic_type?: string | null;
          pacing_instruction?: string | null;
          project_id: string;
          recommended_asset_type?: string;
          scene_index: number;
          script_text?: string;
          sound_status?: string;
          text_overlay_flag?: boolean;
          text_overlay_suggestion?: string | null;
          updated_at?: string;
          user_id: string;
          visual_job?: string | null;
          word_count?: number | null;
          youtube_source_priority?: Json;
        };
        Update: {
          captions_status?: string;
          clip_brief?: Json | null;
          clip_status?: string;
          created_at?: string;
          data_graphic_detail?: string | null;
          data_graphic_flag?: boolean;
          emotional_temperature?: string | null;
          estimated_seconds?: number | null;
          graphics_status?: string;
          id?: string;
          is_real_footage_scene?: boolean;
          motion_graphic_data?: Json | null;
          motion_graphic_type?: string | null;
          pacing_instruction?: string | null;
          project_id?: string;
          recommended_asset_type?: string;
          scene_index?: number;
          script_text?: string;
          sound_status?: string;
          text_overlay_flag?: boolean;
          text_overlay_suggestion?: string | null;
          updated_at?: string;
          user_id?: string;
          visual_job?: string | null;
          word_count?: number | null;
          youtube_source_priority?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "scenes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      search_cache: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          query_string: string;
          results: Json;
        };
        Insert: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          query_string: string;
          results: Json;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          query_string?: string;
          results?: Json;
        };
        Relationships: [];
      };
      sound_style_profiles: {
        Row: {
          aesthetic: string | null;
          ambient_character: string | null;
          avoid_list: Json;
          content_type: string | null;
          created_at: string;
          editing_style: string | null;
          id: string;
          narrative_arc: Json | null;
          project_id: string;
          punctuation_character: string | null;
          signature_moments: Json;
          tension_drone_generated: boolean;
          tension_drone_url: string | null;
          transition_character: string | null;
          updated_at: string;
          user_id: string;
          volume_hierarchy: Json;
        };
        Insert: {
          aesthetic?: string | null;
          ambient_character?: string | null;
          avoid_list?: Json;
          content_type?: string | null;
          created_at?: string;
          editing_style?: string | null;
          id?: string;
          narrative_arc?: Json | null;
          project_id: string;
          punctuation_character?: string | null;
          signature_moments?: Json;
          tension_drone_generated?: boolean;
          tension_drone_url?: string | null;
          transition_character?: string | null;
          updated_at?: string;
          user_id: string;
          volume_hierarchy?: Json;
        };
        Update: {
          aesthetic?: string | null;
          ambient_character?: string | null;
          avoid_list?: Json;
          content_type?: string | null;
          created_at?: string;
          editing_style?: string | null;
          id?: string;
          narrative_arc?: Json | null;
          project_id?: string;
          punctuation_character?: string | null;
          signature_moments?: Json;
          tension_drone_generated?: boolean;
          tension_drone_url?: string | null;
          transition_character?: string | null;
          updated_at?: string;
          user_id?: string;
          volume_hierarchy?: Json;
        };
        Relationships: [];
      };
      style_profiles: {
        Row: {
          clip_source_ratio: string;
          color_temperature: string | null;
          content_type: string | null;
          created_at: string;
          cut_density: string | null;
          editing_style: string | null;
          id: string;
          is_default: boolean;
          music_intensity: string;
          music_profile: string | null;
          name: string;
          pacing_intensity: number;
          text_overlay_frequency: string | null;
          updated_at: string;
          user_id: string;
          visual_style: string | null;
          youtube_source_priority: Json;
        };
        Insert: {
          clip_source_ratio?: string;
          color_temperature?: string | null;
          content_type?: string | null;
          created_at?: string;
          cut_density?: string | null;
          editing_style?: string | null;
          id?: string;
          is_default?: boolean;
          music_intensity?: string;
          music_profile?: string | null;
          name: string;
          pacing_intensity?: number;
          text_overlay_frequency?: string | null;
          updated_at?: string;
          user_id: string;
          visual_style?: string | null;
          youtube_source_priority?: Json;
        };
        Update: {
          clip_source_ratio?: string;
          color_temperature?: string | null;
          content_type?: string | null;
          created_at?: string;
          cut_density?: string | null;
          editing_style?: string | null;
          id?: string;
          is_default?: boolean;
          music_intensity?: string;
          music_profile?: string | null;
          name?: string;
          pacing_intensity?: number;
          text_overlay_frequency?: string | null;
          updated_at?: string;
          user_id?: string;
          visual_style?: string | null;
          youtube_source_priority?: Json;
        };
        Relationships: [];
      };
      thumbnails: {
        Row: {
          concepts: Json;
          created_at: string;
          custom_title_copy: string | null;
          id: string;
          project_id: string;
          selected_concept_index: number | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          concepts?: Json;
          created_at?: string;
          custom_title_copy?: string | null;
          id?: string;
          project_id: string;
          selected_concept_index?: number | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          concepts?: Json;
          created_at?: string;
          custom_title_copy?: string | null;
          id?: string;
          project_id?: string;
          selected_concept_index?: number | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      video_metadata: {
        Row: {
          chapters: Json;
          created_at: string;
          description: string | null;
          hashtags: Json;
          id: string;
          platform_variations: Json;
          project_id: string;
          selected_title: string | null;
          status: string;
          tags: Json;
          titles: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          chapters?: Json;
          created_at?: string;
          description?: string | null;
          hashtags?: Json;
          id?: string;
          platform_variations?: Json;
          project_id: string;
          selected_title?: string | null;
          status?: string;
          tags?: Json;
          titles?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          chapters?: Json;
          created_at?: string;
          description?: string | null;
          hashtags?: Json;
          id?: string;
          platform_variations?: Json;
          project_id?: string;
          selected_title?: string | null;
          status?: string;
          tags?: Json;
          titles?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      voiceovers: {
        Row: {
          audio_url: string | null;
          created_at: string;
          duration_seconds: number | null;
          id: string;
          project_id: string;
          scene_id: string;
          status: string;
          updated_at: string;
          user_id: string;
          voice_id: string | null;
          voice_name: string | null;
          word_count: number | null;
          word_timestamps: Json | null;
          words_per_minute: number | null;
        };
        Insert: {
          audio_url?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          project_id: string;
          scene_id: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          voice_id?: string | null;
          voice_name?: string | null;
          word_count?: number | null;
          word_timestamps?: Json | null;
          words_per_minute?: number | null;
        };
        Update: {
          audio_url?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          project_id?: string;
          scene_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          voice_id?: string | null;
          voice_name?: string | null;
          word_count?: number | null;
          word_timestamps?: Json | null;
          words_per_minute?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "voiceovers_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voiceovers_scene_id_fkey";
            columns: ["scene_id"];
            isOneToOne: false;
            referencedRelation: "scenes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const;
