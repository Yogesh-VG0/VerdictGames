"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { getReviewComments, addReviewComment } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, cn } from "@/lib/utils";
import type { ReviewComment } from "@/lib/types";

interface CommentThreadProps {
  reviewId: string;
  onAuthRequired: () => void;
}

function CommentNode({
  comment,
  reviewId,
  depth,
  onAuthRequired,
}: {
  comment: ReviewComment;
  reviewId: string;
  depth: number;
  onAuthRequired: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");

  const replyMutation = useMutation({
    mutationFn: () => addReviewComment(reviewId, replyText.trim(), comment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewComments", reviewId] });
      setReplyText("");
      setShowReply(false);
    },
  });

  function handleReply() {
    if (!user) {
      onAuthRequired();
      return;
    }
    setShowReply(!showReply);
  }

  return (
    <div className={cn("space-y-2", depth > 0 && "ml-6 pl-3 border-l border-white/[0.06]")}>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={`/profile/${comment.username}`}
            className="font-medium text-foreground hover:text-accent transition-colors"
          >
            {comment.username}
          </Link>
          <span className="text-tertiary">·</span>
          <time className="text-tertiary">{formatDate(comment.createdAt)}</time>
        </div>
        <p className="text-sm text-secondary leading-relaxed">{comment.body}</p>
        {depth < 3 && (
          <button
            onClick={handleReply}
            className="text-xs text-tertiary hover:text-accent transition-colors"
          >
            Reply
          </button>
        )}
      </div>

      <AnimatePresence>
        {showReply && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 py-1">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                maxLength={2000}
                className="flex-1 h-9 px-3 text-sm rounded-lg bg-white/5 border border-white/[0.08] text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && replyText.trim()) {
                    replyMutation.mutate();
                  }
                }}
              />
              <button
                onClick={() => replyText.trim() && replyMutation.mutate()}
                disabled={replyMutation.isPending || !replyText.trim()}
                className="px-3 h-9 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 disabled:opacity-50 transition-all"
              >
                {replyMutation.isPending ? "..." : "Reply"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3 mt-2">
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              reviewId={reviewId}
              depth={depth + 1}
              onAuthRequired={onAuthRequired}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentThread({ reviewId, onAuthRequired }: CommentThreadProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: comments, isLoading } = useQuery({
    queryKey: ["reviewComments", reviewId],
    queryFn: () => getReviewComments(reviewId),
    enabled: isExpanded,
  });

  const addMutation = useMutation({
    mutationFn: () => addReviewComment(reviewId, newComment.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewComments", reviewId] });
      setNewComment("");
    },
  });

  function handleAddComment() {
    if (!user) {
      onAuthRequired();
      return;
    }
    if (newComment.trim()) {
      addMutation.mutate();
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-xs text-tertiary hover:text-accent transition-colors flex items-center gap-1"
      >
        💬 {isExpanded ? "Hide" : "Show"} comments
        <svg
          className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-4"
          >
            {/* New comment input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={user ? "Add a comment..." : "Sign in to comment"}
                maxLength={2000}
                disabled={!user}
                className="flex-1 h-9 px-3 text-sm rounded-lg bg-white/5 border border-white/[0.08] text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 disabled:opacity-50 transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddComment();
                }}
              />
              <button
                onClick={handleAddComment}
                disabled={addMutation.isPending || !newComment.trim()}
                className="px-3 h-9 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 disabled:opacity-50 transition-all"
              >
                {addMutation.isPending ? "..." : "Post"}
              </button>
            </div>

            {/* Comments list */}
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : comments && comments.length > 0 ? (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <CommentNode
                    key={comment.id}
                    comment={comment}
                    reviewId={reviewId}
                    depth={0}
                    onAuthRequired={onAuthRequired}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-tertiary text-center py-3">
                No comments yet. Be the first!
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
