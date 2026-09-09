import React from "react";
import Badge from "../common/Badge";

export default function CueStatusBadge({ status = "idle" }) {
  switch (status) {
    case "ready":
      return (
        <Badge variant="success" size="xs" dot>
          Ready
        </Badge>
      );
    case "generating":
      return (
        <Badge variant="primary" size="xs" dot className="animate-pulse">
          Generating...
        </Badge>
      );
    case "playing":
      return (
        <Badge variant="purple" size="xs" dot className="animate-pulse">
          Playing
        </Badge>
      );
    case "error":
      return (
        <Badge variant="danger" size="xs" dot>
          Error
        </Badge>
      );
    case "idle":
    default:
      return (
        <Badge variant="neutral" size="xs">
          Idle
        </Badge>
      );
  }
}

