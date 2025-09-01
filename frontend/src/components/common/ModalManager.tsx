import React from "react";
import { Modal, Box, IconButton, useTheme, useMediaQuery } from "@mui/material";
import { Close } from "@mui/icons-material";

interface ModalManagerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string | number;
  fullScreen?: boolean;
  title?: string;
}

const ModalManager: React.FC<ModalManagerProps> = ({
  open,
  onClose,
  children,
  maxWidth = "90vw",
  fullScreen = false,
  title,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Use fullscreen on mobile or when explicitly requested
  const shouldUseFullScreen = fullScreen || isMobile;

  const modalStyle = shouldUseFullScreen
    ? {
        position: "absolute" as const,
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        bgcolor: "background.paper",
        overflow: "auto",
      }
    : {
        position: "absolute" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "95%",
        maxWidth: maxWidth,
        maxHeight: "90vh",
        bgcolor: "background.paper",
        borderRadius: 2,
        boxShadow: 24,
        overflow: "auto",
      };

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby={title ? `modal-title-${title}` : "modal"}
      aria-describedby="modal-content"
      closeAfterTransition
      slotProps={{
        backdrop: {
          timeout: 500,
          sx: { backgroundColor: "rgba(0, 0, 0, 0.7)" },
        },
      }}
    >
      <Box sx={modalStyle}>
        {/* Close button */}
        <Box
          sx={{
            position: "sticky",
            top: 0,
            right: 0,
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-end",
            p: 1,
            backgroundColor: shouldUseFullScreen
              ? "background.paper"
              : "transparent",
          }}
        >
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: "text.secondary",
              backgroundColor: "background.paper",
              boxShadow: 1,
              "&:hover": {
                backgroundColor: "action.hover",
              },
            }}
          >
            <Close />
          </IconButton>
        </Box>

        {/* Modal content */}
        <Box sx={{ p: shouldUseFullScreen ? 2 : 3, pt: 0 }}>{children}</Box>
      </Box>
    </Modal>
  );
};

export default ModalManager;
