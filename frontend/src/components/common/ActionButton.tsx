import { LoadingButton } from "@mui/lab";
import { Button, ButtonProps } from "@mui/material";
import React from "react";

interface ActionButtonProps extends Omit<ButtonProps, "loading" | "action"> {
  loading?: boolean;
  action: string;
  onActionClick: () => void;
  confirmationRequired?: boolean;
  loadingText?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  loading = false,
  action,
  onActionClick,
  confirmationRequired = false,
  loadingText,
  children,
  ...buttonProps
}) => {
  const handleClick = () => {
    if (confirmationRequired) {
      if (window.confirm(`Are you sure you want to ${action.toLowerCase()}?`)) {
        onActionClick();
      }
    } else {
      onActionClick();
    }
  };

  if (loading) {
    return (
      <LoadingButton loading variant="outlined" size="small" {...buttonProps}>
        {loadingText || `${action}ing...`}
      </LoadingButton>
    );
  }

  return (
    <Button
      variant="outlined"
      size="small"
      onClick={handleClick}
      {...buttonProps}
    >
      {children || action}
    </Button>
  );
};

export default ActionButton;
